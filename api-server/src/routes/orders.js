const express = require("express");
const { ok, fail } = require("../lib/respond");
const { pool, query } = require("../lib/db");
const { requireAuth } = require("../middleware/auth");
const { requireMerchantShopAccess } = require("../middleware/authorization");
const { requireShopContext, requireUserContext } = require("../lib/request-context");
const { mapMoneyFields } = require("../lib/formatters");
const { wrap } = require("../lib/async-handler");
const { ensureCycle, incrementPayroll, resolveRule } = require("../lib/payroll-service");

const router = express.Router();

router.use("/merchant", requireAuth, requireMerchantShopAccess);

async function findServiceItem(shopId, serviceItemId) {
  if (!serviceItemId) return null;
  const result = await query(
    `select
       id,
       name,
       description,
       service_mode,
       list_price,
       duration_minutes,
       is_active
     from service_items
     where id = $1
       and shop_id = $2`,
    [serviceItemId, shopId]
  );
  return result.rows[0] || null;
}

async function findRoom(shopId, roomId) {
  if (!roomId) return null;
  const result = await query(
    `select
       id,
       name,
       room_type,
       note,
       is_active
     from rooms
     where id = $1
       and shop_id = $2`,
    [roomId, shopId]
  );
  return result.rows[0] || null;
}

async function findCustomer(shopId, customerId) {
  if (!customerId) return null;
  const result = await query(
    `select
       id,
       name,
       phone,
       gender,
       note,
       is_member,
       is_active
     from customers
     where id = $1
       and shop_id = $2`,
    [customerId, shopId]
  );
  return result.rows[0] || null;
}

async function findOrder(shopId, orderId) {
  const result = await query(
    `select
       o.*,
       tp.user_id as technician_user_id,
       tp.name as technician_name,
       tp.avatar_url,
       si.name as service_name,
       si.description as service_description,
       si.duration_minutes as service_duration_minutes,
       r.name as room_name,
       c.name as customer_display_name,
       c.phone as customer_phone
     from orders o
     join technician_profiles tp on tp.user_id = o.technician_user_id
     left join service_items si on si.id = o.service_item_id
     left join rooms r on r.id = o.room_id
     left join customers c on c.id = o.customer_id
     where o.id = $1
       and o.shop_id = $2`,
    [orderId, shopId]
  );
  return result.rows[0] || null;
}

async function resolveOrderPayload(shopId, payload, currentOrder = null) {
  const technicianUserId = payload.technicianUserId || currentOrder?.technician_user_id;
  const serviceItemId = payload.serviceItemId || currentOrder?.service_item_id;
  const roomId = payload.roomId || currentOrder?.room_id;
  const requestedCustomerId = Object.prototype.hasOwnProperty.call(payload, "customerId")
    ? payload.customerId
    : currentOrder?.customer_id;
  const requestedCustomerType = payload.customerType || currentOrder?.customer_type || "walk_in";
  const startTime = payload.startTime || currentOrder?.start_time;
  const endTime = Object.prototype.hasOwnProperty.call(payload, "endTime")
    ? (payload.endTime || null)
    : currentOrder?.end_time || null;
  const note = Object.prototype.hasOwnProperty.call(payload, "note")
    ? payload.note
    : currentOrder?.note;

  if (!technicianUserId || !serviceItemId || !roomId || !startTime) {
    return { error: "technicianUserId, serviceItemId, roomId and startTime are required" };
  }

  const [serviceItem, room, customer] = await Promise.all([
    findServiceItem(shopId, serviceItemId),
    findRoom(shopId, roomId),
    requestedCustomerId ? findCustomer(shopId, requestedCustomerId) : Promise.resolve(null)
  ]);

  if (!serviceItem || !serviceItem.is_active) {
    return { error: "请选择有效的启用项目" };
  }

  if (!room || !room.is_active) {
    return { error: "请选择有效的可用房间" };
  }

  if (requestedCustomerId && (!customer || !customer.is_active)) {
    return { error: "请选择有效的客户档案" };
  }

  const customerType = requestedCustomerId && customer ? "registered" : requestedCustomerType === "registered" ? "registered" : "walk_in";
  const customerId = customerType === "registered" ? requestedCustomerId : null;
  const customerName = customerType === "registered" ? customer?.name : "散客";
  const serviceAmount = Object.prototype.hasOwnProperty.call(payload, "serviceAmount")
    ? Number(payload.serviceAmount || 0)
    : currentOrder
      ? Number(currentOrder.service_amount || 0)
      : Number(serviceItem.list_price || 0);
  const actualAmount = Object.prototype.hasOwnProperty.call(payload, "actualAmount")
    ? Number(payload.actualAmount || 0)
    : currentOrder && currentOrder.service_item_id === serviceItem.id
      ? Number(currentOrder.actual_amount || 0)
      : Number(serviceItem.list_price || 0);
  const durationMinutes = Object.prototype.hasOwnProperty.call(payload, "durationMinutes")
    ? Number(payload.durationMinutes || serviceItem.duration_minutes || 60)
    : currentOrder
      ? Number(currentOrder.duration_minutes || serviceItem.duration_minutes || 60)
      : Number(serviceItem.duration_minutes || 60);

  if (Number.isNaN(serviceAmount) || serviceAmount < 0 || Number.isNaN(actualAmount) || actualAmount < 0) {
    return { error: "服务金额和实收金额必须是有效数字" };
  }
  if (endTime && new Date(endTime).getTime() < new Date(startTime).getTime()) {
    return { error: "结束时间不能早于开始时间" };
  }

  return {
    technicianUserId,
    serviceItem,
    room,
    customer,
    customerId,
    customerType,
    customerName,
    startTime,
    endTime,
    note: note || null,
    orderType: serviceItem.service_mode,
    serviceAmount,
    actualAmount,
    durationMinutes
  };
}

function mapOrderRow(row) {
  return mapMoneyFields(row, ["service_amount", "actual_amount", "list_price"]);
}

async function findMappedOrder(shopId, orderId) {
  const order = await findOrder(shopId, orderId);
  return order ? mapOrderRow(order) : null;
}

router.get("/merchant/orders", requireShopContext, wrap(async (req, res) => {
  const { shopId } = req.ctx;
  const { date, status, page, limit } = req.query;

  const conditions = ["o.shop_id = $1"];
  const params = [shopId];
  let paramIndex = 2;

  if (date) {
    conditions.push(`o.start_time >= $${paramIndex}::date`);
    params.push(date);
    paramIndex++;
    conditions.push(`o.start_time < $${paramIndex}::date + interval '1 day'`);
    params.push(date);
    paramIndex++;
  }

  if (status && ["pending", "in_service", "completed", "cancelled"].includes(status)) {
    conditions.push(`o.status = $${paramIndex}`);
    params.push(status);
    paramIndex++;
  }

  const whereClause = conditions.length > 1
    ? conditions.join(" and ")
    : conditions[0];

  const countResult = await query(
    `select count(*)::int as total
     from orders o
     join technician_profiles tp on tp.user_id = o.technician_user_id
     where ${whereClause}`,
    params
  );

  const total = countResult.rows[0]?.total || 0;
  const pageSize = Math.max(1, Math.min(100, Number(limit) || 20));
  const currentPage = Math.max(1, Number(page) || 1);
  const offset = (currentPage - 1) * pageSize;

  const result = await query(
    `select
       o.id,
       o.order_no,
       o.order_type,
       o.status,
       o.room_id,
       o.room_code,
       o.customer_id,
       o.customer_type,
       o.customer_name,
       o.start_time,
       o.end_time,
       o.duration_minutes,
       o.service_amount,
       o.actual_amount,
       o.note,
       tp.user_id as technician_user_id,
       tp.name as technician_name,
       tp.avatar_url,
       si.id as service_item_id,
       si.name as service_name,
       si.description as service_description,
       si.duration_minutes as service_duration_minutes,
       si.list_price,
       r.name as room_name,
       c.phone as customer_phone
     from orders o
     join technician_profiles tp on tp.user_id = o.technician_user_id
     left join service_items si on si.id = o.service_item_id
     left join rooms r on r.id = o.room_id
     left join customers c on c.id = o.customer_id
     where ${whereClause}
     order by o.start_time desc
     limit $${paramIndex} offset $${paramIndex + 1}`,
    [...params, pageSize, offset]
  );

  return ok(res, {
    orders: result.rows.map((row) => mapOrderRow(row)),
    pagination: {
      total,
      page: currentPage,
      limit: pageSize,
      totalPages: Math.ceil(total / pageSize)
    }
  });
}));

router.post("/merchant/orders", requireShopContext, requireUserContext, wrap(async (req, res) => {
  const { shopId, userId } = req.ctx;
  const resolved = await resolveOrderPayload(shopId, req.body || {});
  if (resolved.error) {
    return fail(res, resolved.error, 400);
  }

  const orderNoResult = await query(
    `select 'ZB-' || lpad((floor(random() * 9000) + 1000)::text, 4, '0') as order_no`
  );

  const result = await query(
    `insert into orders (
       shop_id,
       technician_user_id,
       service_item_id,
       room_id,
       customer_id,
       order_no,
       order_type,
       status,
       customer_type,
       room_code,
       customer_name,
       start_time,
       duration_minutes,
       service_amount,
       actual_amount,
       note,
       created_by
     ) values (
       $1, $2, $3, $4, $5, $6, $7, 'pending', $8, $9, $10, $11, $12, $13, $14, $15, $16
     )
     returning
       id,
       order_no,
       order_type,
       status,
       room_id,
       room_code,
       customer_id,
       customer_type,
       customer_name,
       start_time,
       end_time,
       duration_minutes,
       service_amount,
       actual_amount,
       note`,
    [
      shopId,
      resolved.technicianUserId,
      resolved.serviceItem.id,
      resolved.room.id,
      resolved.customerId,
      orderNoResult.rows[0].order_no,
      resolved.orderType,
      resolved.customerType,
      resolved.room.name,
      resolved.customerName,
      resolved.startTime,
      resolved.durationMinutes,
      resolved.serviceAmount,
      resolved.actualAmount,
      resolved.note,
      userId
    ]
  );

  if (resolved.customerId) {
    await query(
      `update customers
       set
         last_visit_at = now(),
         updated_at = now()
       where id = $1
         and shop_id = $2`,
      [resolved.customerId, shopId]
    );
  }

  return ok(res, {
    order: mapOrderRow({
      ...result.rows[0],
      service_item_id: resolved.serviceItem.id,
      service_name: resolved.serviceItem.name,
      service_description: resolved.serviceItem.description,
      duration_minutes: result.rows[0].duration_minutes,
      list_price: resolved.serviceItem.list_price,
      room_name: resolved.room.name,
      customer_phone: resolved.customer?.phone || null
    })
  }, 201);
}));

router.patch("/merchant/orders/:orderId", requireShopContext, wrap(async (req, res) => {
  const { shopId } = req.ctx;
  const currentOrder = await findOrder(shopId, req.params.orderId);

  if (!currentOrder) {
    return fail(res, "Order not found", 404);
  }

  const resolved = await resolveOrderPayload(shopId, req.body || {}, currentOrder);
  if (resolved.error) {
    return fail(res, resolved.error, 400);
  }

  const client = await pool.connect();
  try {
    await client.query("begin");

    const result = await client.query(
      `update orders
       set
         technician_user_id = $3,
         service_item_id = $4,
         room_id = $5,
         customer_id = $6,
         customer_type = $7,
         order_type = $8,
         room_code = $9,
         customer_name = $10,
         start_time = $11,
         end_time = $12,
         duration_minutes = $13,
         service_amount = $14,
         actual_amount = $15,
         note = $16,
         updated_at = now()
       where id = $1
         and shop_id = $2
       returning
         id,
         order_no,
         order_type,
         status,
         room_id,
         room_code,
         customer_id,
         customer_type,
         customer_name,
         start_time,
         end_time,
         duration_minutes,
         service_amount,
         actual_amount,
         note`,
      [
        req.params.orderId,
        shopId,
        resolved.technicianUserId,
        resolved.serviceItem.id,
        resolved.room.id,
        resolved.customerId,
        resolved.customerType,
        resolved.orderType,
        resolved.room.name,
        resolved.customerName,
        resolved.startTime,
        resolved.endTime,
        resolved.durationMinutes,
        resolved.serviceAmount,
        resolved.actualAmount,
        resolved.note
      ]
    );

    if (resolved.customerId) {
      await client.query(
        `update customers
         set
           last_visit_at = now(),
           updated_at = now()
         where id = $1
           and shop_id = $2`,
        [resolved.customerId, shopId]
      );
    }

    // 如果订单已完成且金额发生变化，更新工资提成记录
    const updatedOrder = result.rows[0];
    if (updatedOrder.status === 'completed' && currentOrder.service_amount !== resolved.serviceAmount) {
      const orderDate = new Date(updatedOrder.start_time);
      const cycleMonth = new Date(Date.UTC(orderDate.getUTCFullYear(), orderDate.getUTCMonth(), 1));
      const ruleDateStr = orderDate.toISOString().slice(0, 10);
      
      try {
        const cycle = await ensureCycle(client, shopId, cycleMonth, userId);
        const rule = await resolveRule(client, shopId, resolved.technicianUserId, ruleDateStr);
        
        if (rule) {
          const serviceAmount = Number(resolved.serviceAmount || 0);
          const isDesignated = resolved.orderType === 'designated';
          const commissionRate = isDesignated ? rule.designated_commission_rate : rule.scheduled_commission_rate;
          const commissionAmount = Math.round(serviceAmount * commissionRate);
          const designatedBonusAmount = isDesignated ? rule.designated_bonus_amount : 0;
          
          await client.query(
            `update payroll_order_items
             set service_amount = $1,
                 commission_rate = $2,
                 commission_amount = $3,
                 designated_bonus_amount = $4,
                 updated_at = now()
             where order_id = $5`,
            [serviceAmount, commissionRate, commissionAmount, designatedBonusAmount, req.params.orderId]
          );
          
          const summaryResult = await client.query(
            `select ps.id, ps.payroll_cycle_id,
                    sum(poi.commission_amount) filter (where poi.order_type = 'scheduled') as scheduled_commission,
                    sum(poi.commission_amount) filter (where poi.order_type = 'designated') as designated_commission,
                    sum(poi.designated_bonus_amount) as total_bonus,
                    sum(poi.service_amount) filter (where poi.order_type = 'scheduled') as scheduled_amount,
                    sum(poi.service_amount) filter (where poi.order_type = 'designated') as designated_amount,
                    count(poi.id) as order_count
             from payroll_summaries ps
             join payroll_order_items poi on poi.payroll_summary_id = ps.id
             where ps.payroll_cycle_id = $1
               and ps.technician_user_id = $2
             group by ps.id, ps.payroll_cycle_id`,
            [cycle.id, resolved.technicianUserId]
          );
          
          if (summaryResult.rows[0]) {
            const s = summaryResult.rows[0];
            const newGross = rule.base_salary + Number(s.scheduled_commission || 0) + Number(s.designated_commission || 0) + Number(s.total_bonus || 0);
            
            await client.query(
              `update payroll_summaries
               set scheduled_amount_total = $1,
                   designated_amount_total = $2,
                   scheduled_commission_amount = $3,
                   designated_commission_amount = $4,
                   designated_bonus_total = $5,
                   gross_salary_amount = $6,
                   updated_at = now()
               where id = $7`,
              [s.scheduled_amount, s.designated_amount, s.scheduled_commission, s.designated_commission, s.total_bonus, newGross, s.id]
            );
          }
        }
      } catch (payrollUpdateError) {
        console.error("Payroll update error for completed order", req.params.orderId, payrollUpdateError.message, payrollUpdateError.stack);
      }
    }

    await client.query("commit");

    return ok(res, {
      order: mapOrderRow({
        ...updatedOrder,
        technician_user_id: resolved.technicianUserId,
        service_item_id: resolved.serviceItem.id,
        service_name: resolved.serviceItem.name,
        service_description: resolved.serviceItem.description,
        duration_minutes: updatedOrder.duration_minutes,
        list_price: resolved.serviceItem.list_price,
        room_name: resolved.room.name,
        customer_phone: resolved.customer?.phone || null
      })
    });
  } catch (error) {
    await client.query("rollback");
    throw error;
  } finally {
    client.release();
  }
}));

router.post("/merchant/orders/:orderId/start", requireShopContext, wrap(async (req, res) => {
  const { shopId } = req.ctx;
  const client = await pool.connect();

  try {
    await client.query("begin");

    const orderResult = await client.query(
      `update orders
       set
         status = 'in_service',
         start_time = now(),
         end_time = null,
         updated_at = now()
       where id = $1
         and shop_id = $2
         and status = 'pending'
       returning
         id, technician_user_id`,
      [req.params.orderId, shopId]
    );

    if (!orderResult.rows[0]) {
      await client.query("rollback");
      return fail(res, "Pending order not found", 404);
    }

    const order = orderResult.rows[0];

    await client.query(
      `insert into technician_work_status_logs (
         shop_id,
         technician_user_id,
         attendance_status,
         service_status,
         changed_by
       ) values ($1, $2, 'on_duty', 'in_service', $3)`,
      [shopId, order.technician_user_id, req.ctx.userId]
    );

    await client.query("commit");

    return ok(res, {
      order: await findMappedOrder(shopId, req.params.orderId)
    });
  } catch (error) {
    await client.query("rollback");
    throw error;
  } finally {
    client.release();
  }
}));

async function completeOrder(req, res) {
  const { shopId } = req.ctx;
  const client = await pool.connect();

  try {
    await client.query("begin");

    const orderResult = await client.query(
      `update orders
       set
         status = 'completed',
         end_time = now(),
         updated_at = now()
       where id = $1
         and shop_id = $2
         and status = 'in_service'
       returning
         id,
         shop_id,
         technician_user_id,
         order_type,
         service_amount,
         actual_amount,
         customer_id,
         start_time`,
      [req.params.orderId, shopId]
    );

    if (!orderResult.rows[0]) {
      await client.query("rollback");
      return fail(res, "In-service order not found", 404);
    }

    const order = orderResult.rows[0];

    await client.query(
      `insert into technician_work_status_logs (
         shop_id,
         technician_user_id,
         attendance_status,
         service_status,
         changed_by
       ) values ($1, $2, 'on_duty', 'available', $3)`,
      [shopId, order.technician_user_id, req.ctx.userId]
    );

    // 更新客户累计消费和会员等级
    if (order.customer_id) {
      await client.query(
        `update customers
         set
           total_spent_cents = total_spent_cents + $1,
           last_visit_at = now(),
           updated_at = now()
         where id = $2
           and shop_id = $3`,
        [Number(order.actual_amount || 0), order.customer_id, shopId]
      );
      
      // 计算并更新会员等级
      const customerResult = await client.query(
        `select total_spent_cents, total_recharged_cents
         from customers
         where id = $1
           and shop_id = $2`,
        [order.customer_id, shopId]
      );
      
      if (customerResult.rows[0]) {
        const { total_spent_cents, total_recharged_cents } = customerResult.rows[0];
        
        // 会员等级配置（与master-data.js保持一致）
        const MEMBER_LEVELS = [
          { level: 1, spendThreshold: 0, rechargeThreshold: 0 },
          { level: 2, spendThreshold: 100000, rechargeThreshold: 1 }, // 充值任意金额即可
          { level: 3, spendThreshold: 200000, rechargeThreshold: 200000 },
          { level: 4, spendThreshold: 500000, rechargeThreshold: 500000 },
          { level: 5, spendThreshold: 1500000, rechargeThreshold: 1500000 },
          { level: 6, spendThreshold: 5000000, rechargeThreshold: 5000000 }
        ];
        
        // 分别计算消费和充值能达到的等级
        let spendLevel = 1;
        let rechargeLevel = 1;
        
        for (const levelConfig of MEMBER_LEVELS) {
          if (Number(total_spent_cents || 0) >= levelConfig.spendThreshold) {
            spendLevel = levelConfig.level;
          }
          if (Number(total_recharged_cents || 0) >= levelConfig.rechargeThreshold) {
            rechargeLevel = levelConfig.level;
          }
        }
        
        // 取最高等级
        const newLevel = Math.max(spendLevel, rechargeLevel);
        
        await client.query(
          `update customers
           set
             member_level = $1,
             is_member = $2
           where id = $3
             and shop_id = $4`,
          [newLevel, newLevel > 1, order.customer_id, shopId]
        );
      }
    }

    const orderDate = new Date(order.start_time);
    const cycleMonth = new Date(Date.UTC(orderDate.getUTCFullYear(), orderDate.getUTCMonth(), 1));

    try {
      const cycle = await ensureCycle(client, shopId, cycleMonth, req.ctx.userId);
      await incrementPayroll(client, shopId, order.technician_user_id, order, cycle);
    } catch (payrollError) {
      console.error("Payroll calculation error for order", order.id, payrollError.message, payrollError.stack);
    }

    await client.query("commit");

    return ok(res, {
      order: await findMappedOrder(shopId, req.params.orderId)
    });
  } catch (error) {
    await client.query("rollback");
    throw error;
  } finally {
    client.release();
  }
}

router.patch("/merchant/orders/:orderId/complete", requireShopContext, wrap(completeOrder));
router.post("/merchant/orders/:orderId/complete", requireShopContext, wrap(completeOrder));

router.patch("/merchant/orders/:orderId/cancel", requireShopContext, wrap(async (req, res) => {
  const { shopId } = req.ctx;
  const client = await pool.connect();

  try {
    await client.query("begin");

    const result = await client.query(
      `update orders
       set
         status = 'cancelled',
         end_time = case when status = 'in_service' then coalesce(end_time, now()) else end_time end,
         updated_at = now()
       where id = $1
         and shop_id = $2
         and status in ('pending', 'in_service')
       returning
         id, technician_user_id`,
      [req.params.orderId, shopId]
    );

    if (!result.rows[0]) {
      await client.query("rollback");
      return fail(res, "Active order not found", 404);
    }

    const order = result.rows[0];

    if (order.technician_user_id) {
      await client.query(
        `insert into technician_work_status_logs (
           shop_id,
           technician_user_id,
           attendance_status,
           service_status,
           changed_by
         ) values ($1, $2, 'on_duty', 'available', $3)`,
        [shopId, order.technician_user_id, req.ctx.userId]
      );
    }

    await client.query("commit");

    return ok(res, {
      order: await findMappedOrder(shopId, req.params.orderId)
    });
  } catch (error) {
    await client.query("rollback");
    throw error;
  } finally {
    client.release();
  }
}));

router.delete("/merchant/orders/:orderId", requireShopContext, wrap(async (req, res) => {
  const { shopId } = req.ctx;
  const client = await pool.connect();

  try {
    await client.query("begin");

    // 首先查找订单，验证存在
    const orderResult = await client.query(
      `select id from orders where id = $1 and shop_id = $2`,
      [req.params.orderId, shopId]
    );

    if (!orderResult.rows[0]) {
      await client.query("rollback");
      return fail(res, "Order not found", 404);
    }

    const orderId = orderResult.rows[0].id;

    // 找到该订单关联的 payroll_order_items 记录
    const payrollItemsResult = await client.query(
      `select payroll_summary_id from payroll_order_items where order_id = $1`,
      [orderId]
    );

    const summaryIds = payrollItemsResult.rows.map(row => row.payroll_summary_id);

    // 删除 payroll_order_items 记录
    await client.query(
      `delete from payroll_order_items where order_id = $1`,
      [orderId]
    );

    // 删除 payroll_summaries 记录（如果该摘要不再有任何订单项）
    for (const summaryId of summaryIds) {
      await client.query(
        `delete from payroll_summaries
         where id = $1
           and not exists (
             select 1 from payroll_order_items
             where payroll_summary_id = $1
           )`,
        [summaryId]
      );
    }

    // 最后删除订单
    const deleteResult = await client.query(
      `delete from orders where id = $1 and shop_id = $2 returning id`,
      [orderId, shopId]
    );

    await client.query("commit");

    return ok(res, {});
  } catch (error) {
    await client.query("rollback");
    throw error;
  } finally {
    client.release();
  }
}));

module.exports = router;
