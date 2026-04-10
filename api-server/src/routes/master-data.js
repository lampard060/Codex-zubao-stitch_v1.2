const express = require("express");
const { ok, fail } = require("../lib/respond");
const { query } = require("../lib/db");
const { requireShopContext } = require("../lib/request-context");
const { mapMoneyFields } = require("../lib/formatters");

const router = express.Router();

router.get("/merchant/order-options", requireShopContext, async (req, res) => {
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
});

router.get("/merchant/service-items", requireShopContext, async (req, res) => {
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
});

router.post("/merchant/service-items", requireShopContext, async (req, res) => {
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
});

router.patch("/merchant/service-items/:serviceItemId", requireShopContext, async (req, res) => {
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
});

router.get("/merchant/rooms", requireShopContext, async (req, res) => {
  const { shopId } = req.ctx;
  const result = await query(
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
  );

  return ok(res, {
    rooms: result.rows
  });
});

router.post("/merchant/rooms", requireShopContext, async (req, res) => {
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
});

router.patch("/merchant/rooms/:roomId", requireShopContext, async (req, res) => {
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
});

router.get("/merchant/customers", requireShopContext, async (req, res) => {
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
       last_visit_at
     from customers
     where shop_id = $1
     order by is_active desc, coalesce(last_visit_at, created_at) desc, name asc`,
    [shopId]
  );

  return ok(res, {
    customers: result.rows
  });
});

router.post("/merchant/customers", requireShopContext, async (req, res) => {
  const { shopId } = req.ctx;
  const { name, phone, gender, note, isMember } = req.body || {};

  if (!name) {
    return fail(res, "name is required", 400);
  }

  const result = await query(
    `insert into customers (
       shop_id,
       name,
       phone,
       gender,
       note,
       is_member
     ) values (
       $1, $2, $3, $4, $5, $6
     )
     returning
       id,
       name,
       phone,
       gender,
       note,
       is_member,
       is_active,
       last_visit_at`,
    [shopId, name, phone || null, gender || null, note || null, Boolean(isMember)]
  );

  return ok(res, {
    customer: result.rows[0]
  }, 201);
});

router.patch("/merchant/customers/:customerId", requireShopContext, async (req, res) => {
  const { shopId } = req.ctx;
  const { name, phone, gender, note, isMember, isActive } = req.body || {};

  const result = await query(
    `update customers
     set
       name = coalesce($3, name),
       phone = coalesce($4, phone),
       gender = coalesce($5, gender),
       note = coalesce($6, note),
       is_member = coalesce($7, is_member),
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
       is_active,
       last_visit_at`,
    [req.params.customerId, shopId, name, phone, gender, note, isMember, isActive]
  );

  if (!result.rows[0]) {
    return fail(res, "Customer not found", 404);
  }

  return ok(res, {
    customer: result.rows[0]
  });
});

module.exports = router;
