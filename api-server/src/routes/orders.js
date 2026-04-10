const express = require("express");
const { ok, fail } = require("../lib/respond");
const { query } = require("../lib/db");
const { requireShopContext, requireUserContext } = require("../lib/request-context");
const { mapMoneyFields } = require("../lib/formatters");

const router = express.Router();

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
       si.name as service_name,
       si.description as service_description,
       si.duration_minutes,
       r.name as room_name,
       c.name as customer_display_name
     from orders o
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

  return {
    technicianUserId,
    serviceItem,
    room,
    customer,
    customerId,
    customerType,
    customerName,
    startTime,
    note: note || null,
    orderType: serviceItem.service_mode,
    serviceAmount: Number(serviceItem.list_price || 0),
    actualAmount: Number(serviceItem.list_price || 0)
  };
}

function mapOrderRow(row) {
  return mapMoneyFields(row, ["service_amount", "actual_amount", "list_price"]);
}

router.get("/merchant/orders", requireShopContext, async (req, res) => {
  const { shopId } = req.ctx;
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
       o.service_amount,
       o.actual_amount,
       o.note,
       tp.user_id as technician_user_id,
       tp.name as technician_name,
       tp.avatar_url,
       si.id as service_item_id,
       si.name as service_name,
       si.description as service_description,
       si.duration_minutes,
       si.list_price,
       r.name as room_name,
       c.phone as customer_phone
     from orders o
     join technician_profiles tp on tp.user_id = o.technician_user_id
     left join service_items si on si.id = o.service_item_id
     left join rooms r on r.id = o.room_id
     left join customers c on c.id = o.customer_id
     where o.shop_id = $1
     order by o.start_time desc
     limit 50`,
    [shopId]
  );

  return ok(res, {
    orders: result.rows.map((row) => mapOrderRow(row))
  });
});

router.post("/merchant/orders", requireShopContext, requireUserContext, async (req, res) => {
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
       service_amount,
       actual_amount,
       note,
       created_by
     ) values (
       $1, $2, $3, $4, $5, $6, $7, 'in_service', $8, $9, $10, $11, $12, $13, $14, $15
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
      duration_minutes: resolved.serviceItem.duration_minutes,
      list_price: resolved.serviceItem.list_price,
      room_name: resolved.room.name,
      customer_phone: resolved.customer?.phone || null
    })
  }, 201);
});

router.patch("/merchant/orders/:orderId", requireShopContext, async (req, res) => {
  const { shopId } = req.ctx;
  const currentOrder = await findOrder(shopId, req.params.orderId);

  if (!currentOrder) {
    return fail(res, "Order not found", 404);
  }

  const resolved = await resolveOrderPayload(shopId, req.body || {}, currentOrder);
  if (resolved.error) {
    return fail(res, resolved.error, 400);
  }

  const result = await query(
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
       service_amount = $12,
       actual_amount = $13,
       note = $14,
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
      resolved.serviceAmount,
      resolved.actualAmount,
      resolved.note
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
      technician_user_id: resolved.technicianUserId,
      service_item_id: resolved.serviceItem.id,
      service_name: resolved.serviceItem.name,
      service_description: resolved.serviceItem.description,
      duration_minutes: resolved.serviceItem.duration_minutes,
      list_price: resolved.serviceItem.list_price,
      room_name: resolved.room.name,
      customer_phone: resolved.customer?.phone || null
    })
  });
});

router.patch("/merchant/orders/:orderId/complete", requireShopContext, async (req, res) => {
  const { shopId } = req.ctx;
  const result = await query(
    `update orders
     set
       status = 'completed',
       end_time = coalesce(end_time, now()),
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
       service_amount,
       actual_amount,
       note`,
    [req.params.orderId, shopId]
  );

  if (!result.rows[0]) {
    return fail(res, "Order not found", 404);
  }

  return ok(res, {
    order: mapOrderRow(result.rows[0])
  });
});

router.patch("/merchant/orders/:orderId/cancel", requireShopContext, async (req, res) => {
  const { shopId } = req.ctx;
  const result = await query(
    `update orders
     set
       status = 'cancelled',
       end_time = coalesce(end_time, now()),
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
       service_amount,
       actual_amount,
       note`,
    [req.params.orderId, shopId]
  );

  if (!result.rows[0]) {
    return fail(res, "Order not found", 404);
  }

  return ok(res, {
    order: mapOrderRow(result.rows[0])
  });
});

module.exports = router;
