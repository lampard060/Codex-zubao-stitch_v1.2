const express = require("express");
const { ok, fail } = require("../lib/respond");
const { pool, query } = require("../lib/db");
const { requireShopContext, requireTechnicianContext, requireUserContext } = require("../lib/request-context");
const { mapMoneyFields } = require("../lib/formatters");
const { resolveMonthRange } = require("../lib/date-range");

const router = express.Router();

router.get("/merchant/technicians", requireShopContext, async (req, res) => {
  const { shopId } = req.ctx;
  const { monthStart, monthEnd } = resolveMonthRange();
  const result = await query(
    `with latest_status as (
       select distinct on (technician_user_id)
         technician_user_id,
         attendance_status,
         service_status,
         changed_at
       from technician_work_status_logs
       where shop_id = $1
       order by technician_user_id, changed_at desc
     ),
     month_stats as (
       select
         technician_user_id,
         count(*) filter (where status = 'completed')::int as completed_order_count,
         coalesce(sum(actual_amount) filter (where status = 'completed'), 0)::int as month_revenue
       from orders
       where shop_id = $1
         and start_time >= $2
         and start_time < $3
       group by technician_user_id
     )
     select
       tp.user_id as technician_user_id,
       tp.name,
       tp.avatar_url,
       tp.specialties,
       tp.bio,
       tp.years_experience,
       sm.joined_at,
       coalesce(ls.attendance_status::text, 'off_duty') as attendance_status,
       coalesce(ls.service_status::text, 'available') as service_status,
       coalesce(ms.completed_order_count, 0) as completed_order_count,
       coalesce(ms.month_revenue, 0) as month_revenue
     from shop_staff_memberships sm
     join technician_profiles tp on tp.user_id = sm.user_id
     left join latest_status ls on ls.technician_user_id = sm.user_id
     left join month_stats ms on ms.technician_user_id = sm.user_id
     where sm.shop_id = $1
       and sm.role_in_shop = 'technician'
       and sm.membership_status = 'active'
     order by tp.created_at asc`,
    [shopId, monthStart, monthEnd]
  );

  return ok(res, {
    technicians: result.rows.map((row) => mapMoneyFields(row, ["month_revenue"]))
  });
});

router.patch("/merchant/technicians/:technicianUserId/status", requireShopContext, requireUserContext, async (req, res) => {
  const { shopId, userId } = req.ctx;
  const { attendanceStatus, serviceStatus } = req.body || {};

  if (!attendanceStatus || !serviceStatus) {
    return fail(res, "attendanceStatus and serviceStatus are required", 400);
  }

  const result = await query(
    `insert into technician_work_status_logs (
       shop_id,
       technician_user_id,
       attendance_status,
       service_status,
       changed_by
     ) values ($1, $2, $3, $4, $5)
     returning
       id,
       shop_id,
       technician_user_id,
       attendance_status,
       service_status,
       changed_by,
       changed_at`,
    [shopId, req.params.technicianUserId, attendanceStatus, serviceStatus, userId]
  );

  return ok(res, {
    statusLog: result.rows[0]
  });
});

router.get("/merchant/technician-applications", requireShopContext, async (req, res) => {
  const { shopId } = req.ctx;
  const result = await query(
    `select
       sja.id,
       sja.status,
       sja.applied_at,
       sja.reviewed_at,
       sja.review_note,
       tp.user_id as technician_user_id,
       tp.name,
       tp.avatar_url,
       tp.specialties,
       tp.years_experience
     from shop_join_applications sja
     join technician_profiles tp on tp.user_id = sja.technician_user_id
     where sja.shop_id = $1
     order by sja.applied_at desc`,
    [shopId]
  );

  return ok(res, {
    applications: result.rows
  });
});

router.post("/merchant/technician-applications/:applicationId/approve", requireShopContext, requireUserContext, async (req, res) => {
  const client = await pool.connect();

  try {
    await client.query("begin");

    const applicationResult = await client.query(
      `update shop_join_applications
       set
         status = 'approved',
         reviewed_at = now(),
         reviewed_by = $3,
         updated_at = now()
       where id = $1
         and shop_id = $2
         and status = 'pending'
       returning id, shop_id, technician_user_id, status, reviewed_at, reviewed_by`,
      [req.params.applicationId, req.ctx.shopId, req.ctx.userId]
    );

    const application = applicationResult.rows[0];
    if (!application) {
      await client.query("rollback");
      return fail(res, "Pending application not found", 404);
    }

    await client.query(
      `insert into shop_staff_memberships (
         shop_id,
         user_id,
         role_in_shop,
         membership_status,
         joined_at
       ) values ($1, $2, 'technician', 'active', now())
       on conflict (shop_id, user_id)
       do update
       set
         membership_status = 'active',
         joined_at = coalesce(shop_staff_memberships.joined_at, now()),
         left_at = null,
         updated_at = now()`,
      [application.shop_id, application.technician_user_id]
    );

    await client.query("commit");

    return ok(res, {
      application
    });
  } catch (error) {
    await client.query("rollback");
    throw error;
  } finally {
    client.release();
  }
});

router.post("/merchant/technician-applications/:applicationId/reject", requireShopContext, requireUserContext, async (req, res) => {
  const result = await query(
    `update shop_join_applications
     set
       status = 'rejected',
       reviewed_at = now(),
       reviewed_by = $3,
       review_note = coalesce($4, review_note),
       updated_at = now()
     where id = $1
       and shop_id = $2
       and status = 'pending'
     returning id, shop_id, technician_user_id, status, reviewed_at, reviewed_by, review_note`,
    [req.params.applicationId, req.ctx.shopId, req.ctx.userId, req.body?.reviewNote || null]
  );

  if (!result.rows[0]) {
    return fail(res, "Pending application not found", 404);
  }

  return ok(res, {
    application: result.rows[0]
  });
});

router.get("/technician/home", requireTechnicianContext, async (req, res) => {
  const { technicianUserId } = req.ctx;
  const { monthStart, monthEnd, monthLabel } = resolveMonthRange();
  const [profileResult, membershipResult, monthStatsResult, latestOrdersResult, latestStatusResult] = await Promise.all([
    query(
      `select user_id as technician_user_id, name, avatar_url, bio, specialties, years_experience
       from technician_profiles
       where user_id = $1`,
      [technicianUserId]
    ),
    query(
      `select
         sm.shop_id,
         s.name as shop_name,
         sm.membership_status,
         sm.joined_at,
         sm.left_at
       from shop_staff_memberships sm
       join shops s on s.id = sm.shop_id
       where sm.user_id = $1
         and sm.role_in_shop = 'technician'
       order by
         case sm.membership_status when 'active' then 0 else 1 end,
         coalesce(sm.joined_at, sm.created_at) desc
       limit 1`,
      [technicianUserId]
    ),
    query(
      `select
         count(*) filter (where status = 'completed')::int as completed_order_count,
         coalesce(sum(actual_amount) filter (where status = 'completed'), 0)::int as month_revenue
       from orders
       where technician_user_id = $1
         and start_time >= $2
         and start_time < $3`,
      [technicianUserId, monthStart, monthEnd]
    ),
    query(
      `select
         id,
         order_no,
         order_type,
         status,
         customer_name,
         room_code,
         start_time,
         end_time,
         actual_amount
       from orders
       where technician_user_id = $1
       order by start_time desc
       limit 5`,
      [technicianUserId]
    ),
    query(
      `select
         shop_id,
         attendance_status,
         service_status,
         changed_at
       from technician_work_status_logs
       where technician_user_id = $1
       order by changed_at desc
       limit 1`,
      [technicianUserId]
    )
  ]);

  return ok(res, {
    month: monthLabel,
    profile: profileResult.rows[0] || null,
    membership: membershipResult.rows[0] || null,
    latestStatus: latestStatusResult.rows[0] || null,
    monthSummary: mapMoneyFields(monthStatsResult.rows[0] || {}, ["month_revenue"]),
    recentOrders: latestOrdersResult.rows.map((row) => mapMoneyFields(row, ["actual_amount"]))
  });
});

router.post("/technician/status", requireTechnicianContext, async (req, res) => {
  const { technicianUserId } = req.ctx;
  const { attendanceStatus, serviceStatus } = req.body || {};

  if (!attendanceStatus || !serviceStatus) {
    return fail(res, "attendanceStatus and serviceStatus are required", 400);
  }

  const membershipResult = await query(
    `select shop_id
     from shop_staff_memberships
     where user_id = $1
       and role_in_shop = 'technician'
       and membership_status = 'active'
     order by coalesce(joined_at, created_at) desc
     limit 1`,
    [technicianUserId]
  );

  const membership = membershipResult.rows[0];
  if (!membership?.shop_id) {
    return fail(res, "No active shop membership found", 400);
  }

  const result = await query(
    `insert into technician_work_status_logs (
       shop_id,
       technician_user_id,
       attendance_status,
       service_status,
       changed_by
     ) values ($1, $2, $3, $4, $2)
     returning
       id,
       shop_id,
       technician_user_id,
       attendance_status,
       service_status,
       changed_at`,
    [membership.shop_id, technicianUserId, attendanceStatus, serviceStatus]
  );

  return ok(res, {
    statusLog: result.rows[0]
  });
});

router.get("/technician/earnings", requireTechnicianContext, async (req, res) => {
  const { technicianUserId } = req.ctx;
  const [earningsResult, trendResult] = await Promise.all([
    query(
      `select
         pc.id as payroll_cycle_id,
         pc.cycle_month,
         ps.id as payroll_summary_id,
         ps.completed_order_count,
         ps.base_salary_amount,
         ps.scheduled_commission_amount,
         ps.designated_commission_amount,
         ps.designated_bonus_total,
         ps.gross_salary_amount,
         ps.payment_status,
         ps.paid_at
       from payroll_summaries ps
       join payroll_cycles pc on pc.id = ps.payroll_cycle_id
       where ps.technician_user_id = $1
       order by pc.cycle_month desc
       limit 6`,
      [technicianUserId]
    ),
    query(
      `with day_series as (
         select generate_series(current_date - interval '6 day', current_date, interval '1 day')::date as day_date
       ),
       daily_orders as (
         select
           date(start_time) as day_date,
           coalesce(sum(actual_amount) filter (where status = 'completed'), 0)::int as revenue
         from orders
         where technician_user_id = $1
           and start_time >= current_date - interval '6 day'
           and start_time < current_date + interval '1 day'
         group by 1
       )
       select
         ds.day_date,
         trim(to_char(ds.day_date, 'Dy')) as weekday_label,
         coalesce(daily.revenue, 0)::int as revenue
       from day_series ds
       left join daily_orders daily on daily.day_date = ds.day_date
       order by ds.day_date asc`,
      [technicianUserId]
    )
  ]);

  return ok(res, {
    earnings: earningsResult.rows.map((row) => mapMoneyFields(row, [
      "base_salary_amount",
      "scheduled_commission_amount",
      "designated_commission_amount",
      "designated_bonus_total",
      "gross_salary_amount"
    ])),
    trend: trendResult.rows.map((row) => mapMoneyFields(row, ["revenue"]))
  });
});

router.get("/technician/profile", requireTechnicianContext, async (req, res) => {
  const { technicianUserId } = req.ctx;
  const result = await query(
    `select
       user_id as technician_user_id,
       name,
       avatar_url,
       bio,
       specialties,
       years_experience
     from technician_profiles
     where user_id = $1`,
    [technicianUserId]
  );

  return ok(res, {
    profile: result.rows[0] || null
  });
});

router.put("/technician/profile", requireTechnicianContext, async (req, res) => {
  const { technicianUserId } = req.ctx;
  const { name, avatarUrl, clearAvatar, bio, specialties, yearsExperience } = req.body || {};
  const result = await query(
    `update technician_profiles
     set
       name = coalesce($2, name),
       avatar_url = case when $7::boolean then null else coalesce($3, avatar_url) end,
       bio = coalesce($4, bio),
       specialties = coalesce($5::jsonb, specialties),
       years_experience = coalesce($6, years_experience),
       updated_at = now()
     where user_id = $1
     returning
       user_id as technician_user_id,
       name,
       avatar_url,
       bio,
       specialties,
       years_experience`,
    [technicianUserId, name, avatarUrl, bio, specialties ? JSON.stringify(specialties) : null, yearsExperience, Boolean(clearAvatar)]
  );

  return ok(res, {
    profile: result.rows[0] || null
  });
});

router.get("/technician/membership", requireTechnicianContext, async (req, res) => {
  const { technicianUserId } = req.ctx;
  const [activeMembershipResult, applicationHistoryResult] = await Promise.all([
    query(
      `select
         sm.id,
         sm.shop_id,
         s.name as shop_name,
         sm.membership_status,
         sm.joined_at,
         sm.left_at
       from shop_staff_memberships sm
       join shops s on s.id = sm.shop_id
       where sm.user_id = $1
         and sm.role_in_shop = 'technician'
       order by
         case sm.membership_status when 'active' then 0 else 1 end,
         coalesce(sm.joined_at, sm.created_at) desc
       limit 1`,
      [technicianUserId]
    ),
    query(
      `select
         sja.id,
         sja.shop_id,
         s.name as shop_name,
         sja.status,
         sja.applied_at,
         sja.reviewed_at,
         sja.review_note
       from shop_join_applications sja
       join shops s on s.id = sja.shop_id
       where sja.technician_user_id = $1
       order by sja.applied_at desc
       limit 10`,
      [technicianUserId]
    )
  ]);

  return ok(res, {
    currentMembership: activeMembershipResult.rows[0] || null,
    applicationHistory: applicationHistoryResult.rows
  });
});

router.post("/technician/shop-applications", requireTechnicianContext, async (req, res) => {
  const { technicianUserId } = req.ctx;
  const { shopId } = req.body || {};

  if (!shopId) {
    return fail(res, "shopId is required", 400);
  }

  const activeMembershipResult = await query(
    `select id
     from shop_staff_memberships
     where user_id = $1
       and role_in_shop = 'technician'
       and membership_status = 'active'
     limit 1`,
    [technicianUserId]
  );

  if (activeMembershipResult.rows[0]) {
    return fail(res, "Active membership exists. Leave current shop before applying to another shop.", 409);
  }

  const result = await query(
    `insert into shop_join_applications (
       shop_id,
       technician_user_id,
       status
     ) values ($1, $2, 'pending')
     returning id, shop_id, technician_user_id, status, applied_at`,
    [shopId, technicianUserId]
  );

  return ok(res, {
    application: result.rows[0]
  }, 201);
});

module.exports = router;
