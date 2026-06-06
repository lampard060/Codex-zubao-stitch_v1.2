const express = require("express");
const { ok, fail } = require("../lib/respond");
const { query } = require("../lib/db");
const { requireAuth } = require("../middleware/auth");
const { requireMerchantShopAccess } = require("../middleware/authorization");
const { requireShopContext } = require("../lib/request-context");
const { mapMoneyFields } = require("../lib/formatters");
const { wrap } = require("../lib/async-handler");

// 会员等级配置
const MEMBER_LEVELS = [
  { level: 1, name: "普通会员", spendThreshold: 0, rechargeThreshold: 0 },
  { level: 2, name: "青铜会员", spendThreshold: 100000, rechargeThreshold: 1 }, // 充值任意金额即可
  { level: 3, name: "白银会员", spendThreshold: 200000, rechargeThreshold: 200000 },
  { level: 4, name: "黄金会员", spendThreshold: 500000, rechargeThreshold: 500000 },
  { level: 5, name: "铂金会员", spendThreshold: 1500000, rechargeThreshold: 1500000 },
  { level: 6, name: "钻石会员", spendThreshold: 5000000, rechargeThreshold: 5000000 }
];

// 根据累计消费和累计充值计算会员等级
function calculateMemberLevel(totalSpentCents, totalRechargedCents) {
  let spendLevel = 1;
  let rechargeLevel = 1;
  
  // 分别计算消费和充值能达到的等级
  for (const levelConfig of MEMBER_LEVELS) {
    if (totalSpentCents >= levelConfig.spendThreshold) {
      spendLevel = levelConfig.level;
    }
    if (totalRechargedCents >= levelConfig.rechargeThreshold) {
      rechargeLevel = levelConfig.level;
    }
  }
  
  // 取最高等级
  return Math.max(spendLevel, rechargeLevel);
}

// 获取会员等级名称
function getMemberLevelName(level) {
  const levelConfig = MEMBER_LEVELS.find(l => l.level === level);
  return levelConfig ? levelConfig.name : "普通会员";
}

const router = express.Router();

router.use("/merchant", requireAuth, requireMerchantShopAccess);

router.get("/merchant/order-options", requireShopContext, wrap(async (req, res) => {
  const { shopId } = req.ctx;
  const [techniciansResult, serviceItemsResult, roomsResult, customersResult] = await Promise.all([
    query(
      `with latest_status as (
         select distinct on (technician_user_id)
           technician_user_id,
           attendance_status,
           service_status,
           changed_at
         from technician_work_status_logs
         where shop_id = $1
         order by technician_user_id, changed_at desc
       )
       select
         tp.user_id as technician_user_id,
         tp.name,
         tp.avatar_url,
         coalesce(ls.attendance_status::text, 'off_duty') as attendance_status,
         coalesce(ls.service_status::text, 'available') as service_status
       from shop_staff_memberships sm
       join technician_profiles tp on tp.user_id = sm.user_id
       left join latest_status ls on ls.technician_user_id = sm.user_id
       where sm.shop_id = $1
         and sm.role_in_shop = 'technician'
         and sm.membership_status = 'active'
       order by tp.name asc`,
      [shopId]
    ),
    query(
      `select
         id,
         name,
         description,
         service_mode,
         list_price,
         duration_minutes,
         is_active
       from service_items
       where shop_id = $1
       order by is_active desc, created_at asc, name asc`,
      [shopId]
    ),
    query(
      `select
         id,
         name,
         room_type,
         note,
         is_active
       from rooms
       where shop_id = $1
       order by is_active desc, created_at asc, name asc`,
      [shopId]
    ),
    query(
      `select
         id,
         name,
         phone,
         gender,
         note,
         is_member,
         is_active,
         last_visit_at
       from customers
       where shop_id = $1
       order by is_active desc, coalesce(last_visit_at, created_at) desc, name asc`,
      [shopId]
    )
  ]);

  return ok(res, {
    technicians: techniciansResult.rows,
    serviceItems: serviceItemsResult.rows.map((row) => mapMoneyFields(row, ["list_price"])),
    rooms: roomsResult.rows,
    customers: customersResult.rows
  });
}));

router.get("/merchant/service-items", requireShopContext, wrap(async (req, res) => {
  const { shopId } = req.ctx;
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
     where shop_id = $1
     order by is_active desc, created_at asc, name asc`,
    [shopId]
  );

  return ok(res, {
    serviceItems: result.rows.map((row) => mapMoneyFields(row, ["list_price"]))
  });
}));

router.post("/merchant/service-items", requireShopContext, wrap(async (req, res) => {
  const { shopId } = req.ctx;
  const { name, description, serviceMode, listPrice, durationMinutes } = req.body || {};

  if (!name || !serviceMode || !listPrice || !durationMinutes) {
    return fail(res, "name, serviceMode, listPrice and durationMinutes are required", 400);
  }

  const result = await query(
    `insert into service_items (
       shop_id,
       name,
       description,
       service_mode,
       list_price,
       duration_minutes
     ) values (
       $1, $2, $3, $4, $5, $6
     )
     returning
       id,
       name,
       description,
       service_mode,
       list_price,
       duration_minutes,
       is_active`,
    [shopId, name, description || null, serviceMode, listPrice, durationMinutes]
  );

  return ok(res, {
    serviceItem: mapMoneyFields(result.rows[0], ["list_price"])
  }, 201);
}));

router.patch("/merchant/service-items/:serviceItemId", requireShopContext, wrap(async (req, res) => {
  const { shopId } = req.ctx;
  const { name, description, serviceMode, listPrice, durationMinutes, isActive } = req.body || {};

  const result = await query(
    `update service_items
     set
       name = coalesce($3, name),
       description = coalesce($4, description),
       service_mode = coalesce($5, service_mode),
       list_price = coalesce($6, list_price),
       duration_minutes = coalesce($7, duration_minutes),
       is_active = coalesce($8, is_active),
       updated_at = now()
     where id = $1
       and shop_id = $2
     returning
       id,
       name,
       description,
       service_mode,
       list_price,
       duration_minutes,
       is_active`,
    [req.params.serviceItemId, shopId, name, description, serviceMode, listPrice, durationMinutes, isActive]
  );

  if (!result.rows[0]) {
    return fail(res, "Service item not found", 404);
  }

  return ok(res, {
    serviceItem: mapMoneyFields(result.rows[0], ["list_price"])
  });
}));

router.delete("/merchant/service-items/:serviceItemId", requireShopContext, wrap(async (req, res) => {
  const { shopId } = req.ctx;

  const orderCheckResult = await query(
    `select count(*) as order_count
     from orders
     where service_item_id = $1`,
    [req.params.serviceItemId]
  );

  const orderCount = orderCheckResult.rows[0].order_count;
  if (orderCount > 0) {
    return fail(res, `无法删除，该项目已有 ${orderCount} 笔订单关联`, 400);
  }

  const result = await query(
    `delete from service_items
     where id = $1
       and shop_id = $2
     returning id`,
    [req.params.serviceItemId, shopId]
  );

  if (!result.rows[0]) {
    return fail(res, "Service item not found", 404);
  }

  return ok(res, {
    message: "Service item deleted successfully"
  });
}));

router.get("/merchant/rooms", requireShopContext, wrap(async (req, res) => {
  const { shopId } = req.ctx;
  const result = await query(
    `select
       r.id,
       r.name,
       r.room_type,
       r.note,
       r.is_active,
       exists (
         select 1 from orders o 
         where o.room_id = r.id 
         and o.status = 'in_service'
       ) as is_busy
     from rooms r
     where r.shop_id = $1
     order by r.is_active desc, r.created_at asc, r.name asc`,
    [shopId]
  );

  return ok(res, {
    rooms: result.rows
  });
}));

router.post("/merchant/rooms", requireShopContext, wrap(async (req, res) => {
  const { shopId } = req.ctx;
  const { name, roomType, note } = req.body || {};

  if (!name) {
    return fail(res, "name is required", 400);
  }

  const result = await query(
    `insert into rooms (
       shop_id,
       name,
       room_type,
       note
     ) values (
       $1, $2, $3, $4
     )
     returning
       id,
       name,
       room_type,
       note,
       is_active`,
    [shopId, name, roomType || null, note || null]
  );

  return ok(res, {
    room: result.rows[0]
  }, 201);
}));

router.patch("/merchant/rooms/:roomId", requireShopContext, wrap(async (req, res) => {
  const { shopId } = req.ctx;
  const { name, roomType, note, isActive } = req.body || {};
  const result = await query(
    `update rooms
     set
       name = coalesce($3, name),
       room_type = coalesce($4, room_type),
       note = coalesce($5, note),
       is_active = coalesce($6, is_active),
       updated_at = now()
     where id = $1
       and shop_id = $2
     returning
       id,
       name,
       room_type,
       note,
       is_active`,
    [req.params.roomId, shopId, name, roomType, note, isActive]
  );

  if (!result.rows[0]) {
    return fail(res, "Room not found", 404);
  }

  return ok(res, {
    room: result.rows[0]
  });
}));

router.delete("/merchant/rooms/:roomId", requireShopContext, wrap(async (req, res) => {
  const { shopId } = req.ctx;
  const result = await query(
    `delete from rooms
     where id = $1
       and shop_id = $2
     returning id`,
    [req.params.roomId, shopId]
  );

  if (!result.rows[0]) {
    return fail(res, "Room not found", 404);
  }

  return ok(res, {
    message: "Room deleted successfully"
  });
}));

router.get("/merchant/customers", requireShopContext, wrap(async (req, res) => {
  const { shopId } = req.ctx;
  const result = await query(
    `select
       id,
       name,
       phone,
       gender,
       note,
       is_member,
       is_active,
       last_visit_at,
       total_spent_cents,
       total_recharged_cents,
       member_level
     from customers
     where shop_id = $1
     order by is_active desc, coalesce(last_visit_at, created_at) desc, name asc`,
    [shopId]
  );

  // 计算会员等级（确保数据最新）
  const customers = result.rows.map(customer => {
    const calculatedLevel = calculateMemberLevel(
      Number(customer.total_spent_cents || 0),
      Number(customer.total_recharged_cents || 0)
    );
    return {
      ...customer,
      member_level: calculatedLevel,
      member_level_name: getMemberLevelName(calculatedLevel),
      total_spent: Number(customer.total_spent_cents || 0),
      total_recharged: Number(customer.total_recharged_cents || 0)
    };
  });

  return ok(res, {
    customers
  });
}));

router.post("/merchant/customers", requireShopContext, wrap(async (req, res) => {
  const { shopId } = req.ctx;
  const { name, phone, gender, note, memberLevel } = req.body || {};

  if (!name) {
    return fail(res, "name is required", 400);
  }
  
  const level = memberLevel || 1;

  const result = await query(
    `insert into customers (
       shop_id,
       name,
       phone,
       gender,
       note,
       is_member,
       member_level
     ) values (
       $1, $2, $3, $4, $5, $6, $7
     )
     returning
       id,
       name,
       phone,
       gender,
       note,
       is_member,
       member_level,
       is_active,
       last_visit_at,
       total_spent_cents,
       total_recharged_cents`,
    [shopId, name, phone || null, gender || null, note || null, level > 1, level]
  );
  
  const customer = result.rows[0];
  
  return ok(res, {
    customer: {
      ...customer,
      member_level_name: getMemberLevelName(customer.member_level),
      total_spent: Number(customer.total_spent_cents || 0),
      total_recharged: Number(customer.total_recharged_cents || 0)
    }
  }, 201);
}));

router.patch("/merchant/customers/:customerId", requireShopContext, wrap(async (req, res) => {
  const { shopId } = req.ctx;
  const { name, phone, gender, note, memberLevel, isActive } = req.body || {};

  const result = await query(
    `update customers
     set
       name = coalesce($3, name),
       phone = coalesce($4, phone),
       gender = coalesce($5, gender),
       note = coalesce($6, note),
       member_level = coalesce($7, member_level),
       is_member = case
         when $7 is not null then $7 > 1
         else is_member
       end,
       is_active = coalesce($8, is_active),
       updated_at = now()
     where id = $1
       and shop_id = $2
     returning
       id,
       name,
       phone,
       gender,
       note,
       is_member,
       member_level,
       is_active,
       last_visit_at,
       total_spent_cents,
       total_recharged_cents`,
    [req.params.customerId, shopId, name, phone, gender, note, memberLevel, isActive]
  );

  if (!result.rows[0]) {
    return fail(res, "Customer not found", 404);
  }
  
  const customer = result.rows[0];
  
  return ok(res, {
    customer: {
      ...customer,
      member_level_name: getMemberLevelName(customer.member_level),
      total_spent: Number(customer.total_spent_cents || 0),
      total_recharged: Number(customer.total_recharged_cents || 0)
    }
  });
}));

router.delete("/merchant/customers/:customerId", requireShopContext, wrap(async (req, res) => {
  const { shopId } = req.ctx;

  const orderCheckResult = await query(
    `select count(*) as order_count
     from orders
     where customer_name in (select name from customers where id = $1)`,
    [req.params.customerId]
  );

  const orderCount = orderCheckResult.rows[0].order_count;
  if (orderCount > 0) {
    return fail(res, `无法删除，该会员已有 ${orderCount} 笔订单关联`, 400);
  }

  const result = await query(
    `delete from customers
     where id = $1
       and shop_id = $2
     returning id`,
    [req.params.customerId, shopId]
  );

  if (!result.rows[0]) {
    return fail(res, "Customer not found", 404);
  }

  return ok(res, {
    message: "Customer deleted successfully"
  });
}));

module.exports = router;
