const express = require("express");
const { ok, fail } = require("../lib/respond");
const { pool, query } = require("../lib/db");
const { requireAuth } = require("../middleware/auth");
const { requireMerchantShopAccess, requireTechnicianSelf } = require("../middleware/authorization");
const { requireShopContext, requireTechnicianContext, requireUserContext } = require("../lib/request-context");
const { mapMoneyFields } = require("../lib/formatters");
const { resolveMonthRange } = require("../lib/date-range");
const { wrap } = require("../lib/async-handler");
const { ensureCycle, incrementPayroll } = require("../lib/payroll-service");

const router = express.Router();

router.use("/merchant", requireAuth, requireMerchantShopAccess);
router.use("/technician", requireAuth, requireTechnicianSelf);

function resolveRevenueMaxIndex(trendRows) {
  if (!Array.isArray(trendRows) || !trendRows.length) {
    return -1;
  }

  const maxRevenue = Math.max(...trendRows.map((item) => Number(item.revenue || 0)), 0);
  if (maxRevenue <= 0) {
    return -1;
  }

  return trendRows.findIndex((item) => Number(item.revenue || 0) === maxRevenue);
}

function buildPeriodTrendText(currentValue, previousValue, baselineLabel) {
  const current = Number(currentValue || 0);
  const previous = Number(previousValue || 0);

  if (previous <= 0) {
    if (current <= 0) {
      return `暂无${baselineLabel}对比数据`;
    }
    return `新增收益，较${baselineLabel}开始增长`;
  }

  const changeRate = ((current - previous) / previous) * 100;
  const roundedRate = Math.abs(changeRate).toFixed(1).replace(/\.0$/, "");
  const prefix = changeRate >= 0 ? "+" : "-";

  return `${prefix}${roundedRate}% 较${baselineLabel}`;
}

function formatCycleMonthText(cycleMonth) {
  if (!cycleMonth) {
    return "";
  }

  const value = new Date(cycleMonth);
  if (Number.isNaN(value.getTime())) {
    return String(cycleMonth);
  }

  return `${value.getMonth() + 1}月`;
}

router.get("/merchant/technicians", requireShopContext, wrap(async (req, res) => {
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
     ),
     active_order as (
       select distinct on (technician_user_id)
         technician_user_id,
         start_time as active_order_start_time,
         duration_minutes as active_order_duration
       from orders
       where shop_id = $1
         and status = 'in_service'
       order by technician_user_id, start_time desc
     )
     select
     tp.user_id as technician_user_id,
     tp.name,
     tp.avatar_url,
     tp.employee_no,
     tp.specialties,
     tp.bio,
     tp.years_experience,
     tp.gender,
     tp.birth_date,
     tp.id_card,
     tp.address,
     tp.emergency_contact_name,
     tp.emergency_contact_phone,
     u.phone,
     sm.joined_at,
      coalesce(ls.attendance_status::text, 'off_duty') as attendance_status,
      coalesce(ls.service_status::text, 'available') as service_status,
      coalesce(ms.completed_order_count, 0) as completed_order_count,
      coalesce(ms.month_revenue, 0) as month_revenue,
      ao.active_order_start_time,
      ao.active_order_duration
    from shop_staff_memberships sm
    join technician_profiles tp on tp.user_id = sm.user_id
    join users u on u.id = sm.user_id
    left join latest_status ls on ls.technician_user_id = sm.user_id
    left join month_stats ms on ms.technician_user_id = sm.user_id
    left join active_order ao on ao.technician_user_id = sm.user_id
    where sm.shop_id = $1
      and sm.role_in_shop = 'technician'
      and sm.membership_status = 'active'
    order by tp.created_at asc`,
    [shopId, monthStart, monthEnd]
  );

  return ok(res, {
    technicians: result.rows.map((row) => mapMoneyFields(row, ["month_revenue"]))
  });
}));

router.patch("/merchant/technicians/:technicianUserId/status", requireShopContext, requireUserContext, wrap(async (req, res) => {
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
}));

router.get("/merchant/technician-applications", requireShopContext, wrap(async (req, res) => {
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
}));

router.get("/merchant/technician-leave-applications", requireShopContext, wrap(async (req, res) => {
  const { shopId } = req.ctx;
  const result = await query(
    `select
       sla.id,
       sla.status,
       sla.reason,
       sla.applied_at,
       sla.reviewed_at,
       sla.review_note,
       tp.user_id as technician_user_id,
       tp.name,
       tp.avatar_url,
       tp.specialties,
       tp.years_experience
     from shop_leave_applications sla
     join technician_profiles tp on tp.user_id = sla.technician_user_id
     where sla.shop_id = $1
     order by
       case sla.status when 'pending' then 0 when 'rejected' then 1 else 2 end,
       sla.applied_at desc`,
    [shopId]
  );

  return ok(res, {
    applications: result.rows
  });
}));

router.post("/merchant/technician-applications/:applicationId/approve", requireShopContext, requireUserContext, wrap(async (req, res) => {
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
}));

router.post("/merchant/technician-applications/:applicationId/reject", requireShopContext, requireUserContext, wrap(async (req, res) => {
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
}));

router.post("/merchant/technician-leave-applications/:applicationId/approve", requireShopContext, requireUserContext, wrap(async (req, res) => {
  const client = await pool.connect();

  try {
    await client.query("begin");

    const applicationResult = await client.query(
      `update shop_leave_applications
       set
         status = 'approved',
         reviewed_at = now(),
         reviewed_by = $3,
         review_note = coalesce($4, review_note),
         updated_at = now()
       where id = $1
         and shop_id = $2
         and status = 'pending'
       returning id, shop_id, technician_user_id, membership_id, status, reviewed_at, reviewed_by, review_note`,
      [req.params.applicationId, req.ctx.shopId, req.ctx.userId, req.body?.reviewNote || null]
    );

    const application = applicationResult.rows[0];
    if (!application) {
      await client.query("rollback");
      return fail(res, "Pending leave application not found", 404);
    }

    const membershipResult = await client.query(
      `update shop_staff_memberships
       set
         membership_status = 'left',
         left_at = now(),
         updated_at = now()
       where shop_id = $1
         and user_id = $2
         and role_in_shop = 'technician'
         and membership_status = 'active'
       returning id, shop_id, user_id`,
      [application.shop_id, application.technician_user_id]
    );

    const membership = membershipResult.rows[0];
    if (!membership) {
      await client.query("rollback");
      return fail(res, "Active membership not found", 404);
    }

    await client.query(
      `insert into technician_work_status_logs (
         shop_id,
         technician_user_id,
         attendance_status,
         service_status,
         changed_by
       ) values ($1, $2, 'off_duty', 'unavailable', $3)`,
      [application.shop_id, application.technician_user_id, req.ctx.userId]
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
}));

router.post("/merchant/technician-leave-applications/:applicationId/reject", requireShopContext, requireUserContext, wrap(async (req, res) => {
  const result = await query(
    `update shop_leave_applications
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
    return fail(res, "Pending leave application not found", 404);
  }

  return ok(res, {
    application: result.rows[0]
  });
}));

router.get("/technician/home", requireTechnicianContext, wrap(async (req, res) => {
  const { technicianUserId } = req.ctx;
  const { monthStart, monthEnd, monthLabel } = resolveMonthRange();
  const [profileResult, membershipResult, monthStatsResult, todayStatsResult, latestOrdersResult, latestStatusResult] = await Promise.all([
    query(
      `select user_id as technician_user_id, name, avatar_url, employee_no, bio, specialties, years_experience
       from technician_profiles
       where user_id = $1`,
      [technicianUserId]
    ),
    query(
      `select
         sm.shop_id,
         s.name as shop_name,
         s.address as shop_address,
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
         count(*) filter (where status = 'completed')::int as today_completed_count,
         coalesce(sum(coalesce(poi.commission_amount, 0) + coalesce(poi.designated_bonus_amount, 0)) filter (where o.status = 'completed'), 0)::int as today_income,
         count(*) filter (where status = 'pending')::int as today_pending_count,
         count(*) filter (where status = 'in_service')::int as today_in_service_count
       from orders o
       left join payroll_order_items poi on poi.order_id = o.id
       where o.technician_user_id = $1
         and o.start_time >= current_date
         and o.start_time < current_date + interval '1 day'`,
      [technicianUserId]
    ),
    query(
      `select
         o.id,
         o.order_no,
         o.order_type,
         o.status,
         o.customer_name,
         o.room_code,
         o.room_id,
         o.start_time,
         o.end_time,
         o.duration_minutes,
         o.actual_amount,
         o.service_amount,
         si.name as service_name,
         si.duration_minutes as service_duration_minutes,
         r.name as room_name,
         poi.commission_amount,
         poi.designated_bonus_amount
       from orders o
       left join service_items si on si.id = o.service_item_id
       left join rooms r on r.id = o.room_id
       left join payroll_order_items poi on poi.order_id = o.id
       where o.technician_user_id = $1
         and (
           o.status in ('pending', 'in_service')
           or (
             o.status in ('completed', 'cancelled')
             and o.start_time >= current_date
             and o.start_time < current_date + interval '1 day'
           )
         )
       order by
         case
           when o.status = 'in_service' then 0
           when o.status = 'pending' then 1
           when o.status = 'completed' then 2
           else 3
         end,
         case when o.status in ('pending', 'in_service') then o.start_time end asc,
         case when o.status in ('completed', 'cancelled') then coalesce(o.end_time, o.start_time) end desc
       limit 8`,
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

  const profile = profileResult.rows[0] || null;
  const membership = membershipResult.rows[0] || null;
  const latestStatus = latestStatusResult.rows[0] || null;
  const todayStats = mapMoneyFields(todayStatsResult.rows[0] || {}, ["today_income"]);

  const serviceStatus = latestStatus?.service_status || 'available';
  const attendanceStatus = latestStatus?.attendance_status || 'off_duty';

  const orders = latestOrdersResult.rows.map((row) => {
    const mapped = mapMoneyFields(row, ["actual_amount", "service_amount", "commission_amount", "designated_bonus_amount"]);
    const durationMinutes = Math.max(60, Number(mapped.service_duration_minutes || mapped.duration_minutes || 90));
    const startTime = mapped.start_time ? new Date(mapped.start_time).getTime() : 0;
    const endTime = mapped.end_time ? new Date(mapped.end_time).getTime() : (startTime > 0 ? startTime + durationMinutes * 60000 : 0);
    const remainingSeconds = mapped.status === 'in_service' && endTime > 0
      ? Math.max(0, Math.round((endTime - Date.now()) / 1000))
      : 0;
    const totalSeconds = durationMinutes * 60;

    return {
      id: mapped.id,
      order_no: mapped.order_no,
      order_type: mapped.order_type,
      status: mapped.status,
      customer_name: mapped.customer_name,
      room: mapped.room_name || mapped.room_code || "--",
      service_name: mapped.service_name || "服务项目",
      start_time: mapped.start_time,
      end_time: mapped.end_time,
      duration_minutes: durationMinutes,
      actual_amount: mapped.actual_amount,
      service_amount: mapped.service_amount,
      remaining_seconds: remainingSeconds,
      total_seconds: totalSeconds,
      commission_amount: mapped.commission_amount,
      designated_bonus_amount: mapped.designated_bonus_amount
    };
  });

  return ok(res, {
    month: monthLabel,
    technician_name: profile?.name || "",
    employee_id: profile?.employee_no || "",
    avatar_url: profile?.avatar_url || "",
    status: serviceStatus,
    attendance_status: attendanceStatus,
    profile: profile,
    membership: membership,
    latestStatus: latestStatus,
    today_orders: Number(todayStats.today_completed_count || 0),
    today_income: Number(todayStats.today_income || 0),
    today_pending: Number(todayStats.today_pending_count || 0),
    today_in_service: Number(todayStats.today_in_service_count || 0),
    monthSummary: mapMoneyFields(monthStatsResult.rows[0] || {}, ["month_revenue"]),
    orders: orders
  });
}));

router.post("/technician/status", requireTechnicianContext, wrap(async (req, res) => {
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
}));

router.get("/technician/earnings", requireTechnicianContext, wrap(async (req, res) => {
  const { technicianUserId } = req.ctx;
  const period = req.query.period || "month";

  if (period === "today") {
    const [summaryResult, trendResult, detailsResult] = await Promise.all([
      query(
        `select
           count(*) filter (
             where status = 'completed'
               and start_time >= current_date
               and start_time < current_date + interval '1 day'
           )::int as completed_order_count,
           coalesce(sum(coalesce(poi.commission_amount, 0) + coalesce(poi.designated_bonus_amount, 0)) filter (
             where o.status = 'completed'
               and o.start_time >= current_date
               and o.start_time < current_date + interval '1 day'
           ), 0)::int as today_income,
           coalesce(sum(o.actual_amount) filter (
             where o.status = 'completed'
               and o.start_time >= current_date
               and o.start_time < current_date + interval '1 day'
           ), 0)::int as today_service_amount,
           coalesce(sum(coalesce(poi.commission_amount, 0) + coalesce(poi.designated_bonus_amount, 0)) filter (
             where o.status = 'completed'
               and o.start_time >= current_date - interval '1 day'
               and o.start_time < current_date
           ), 0)::int as yesterday_income
         from orders o
         left join payroll_order_items poi on poi.order_id = o.id
         where o.technician_user_id = $1`,
        [technicianUserId]
      ),
      query(
        `with day_series as (
           select generate_series(current_date - interval '6 day', current_date, interval '1 day')::date as day_date
         ),
         daily_orders as (
           select
             date(o.start_time) as day_date,
             coalesce(sum(coalesce(poi.commission_amount, 0) + coalesce(poi.designated_bonus_amount, 0)) filter (where o.status = 'completed'), 0)::int as revenue
           from orders o
           left join payroll_order_items poi on poi.order_id = o.id
           where o.technician_user_id = $1
             and o.start_time >= current_date - interval '6 day'
             and o.start_time < current_date + interval '1 day'
           group by 1
         )
         select
           ds.day_date,
           to_char(ds.day_date, 'MM/DD') as label,
           coalesce(do2.revenue, 0)::int as revenue
         from day_series ds
         left join daily_orders do2 on do2.day_date = ds.day_date
         order by ds.day_date asc`,
        [technicianUserId]
      ),
      query(
        `select
           o.id,
           o.order_no,
           o.order_type,
           si.name as service_name,
           o.start_time,
           o.end_time,
           o.service_amount,
           o.actual_amount,
           poi.commission_amount,
           poi.designated_bonus_amount,
           o.status
         from orders o
         left join service_items si on si.id = o.service_item_id
         left join payroll_order_items poi on poi.order_id = o.id
         where o.technician_user_id = $1
           and o.start_time >= current_date - interval '6 day'
           and o.start_time < current_date + interval '1 day'
           and o.status = 'completed'
         order by o.start_time desc
         limit 10`,
        [technicianUserId]
      )
    ]);

    const summary = mapMoneyFields(summaryResult.rows[0] || {}, [
      "today_income",
      "today_service_amount",
      "yesterday_income"
    ]);
    const trend = (trendResult.rows || []).map((row) => mapMoneyFields(row, ["revenue"]));
    const maxIndex = resolveRevenueMaxIndex(trend);

    return ok(res, {
      period: "today",
      label: "今日累计收益",
      total: summary.today_income || 0,
      orders: summary.completed_order_count || 0,
      amount: summary.today_service_amount || 0,
      amountLabel: "服务总额",
      trendText: buildPeriodTrendText(summary.today_income, summary.yesterday_income, "昨日"),
      chart: trend.map((t) => t.revenue),
      chartLabels: trend.map((t) => t.label),
      chartMaxIndex: maxIndex,
      details: (detailsResult.rows || []).map((row) => mapMoneyFields(row, ["actual_amount", "commission_amount", "designated_bonus_amount"])).map((row) => ({
        id: row.id,
        name: row.service_name || "服务项目",
        time: row.start_time ? new Date(row.start_time).toLocaleDateString("zh-CN", { month: "short", day: "numeric" }) : "",
        duration: row.start_time ? new Date(row.start_time).toLocaleTimeString("zh-CN", { hour: "2-digit", minute: "2-digit" }) : "",
        amount: Number(row.commission_amount || 0) + Number(row.designated_bonus_amount || 0),
        orderAmount: Number(row.actual_amount || 0),
        status: row.status,
        icon: "spa"
      }))
    });
  }

  if (period === "salary") {
    const [summaryResult, trendResult, detailsResult] = await Promise.all([
      query(
        `select
           coalesce(sum(ps.completed_order_count), 0)::int as completed_order_count,
           coalesce(sum(ps.gross_salary_amount), 0)::int as total_salary,
           count(*)::int as salary_month_count,
           coalesce(sum(ps.scheduled_commission_amount + ps.designated_commission_amount + ps.designated_bonus_total), 0)::int as total_commission_income,
           coalesce(sum(ps.gross_salary_amount) filter (
             where pc.cycle_month = date_trunc('month', current_date)::date
           ), 0)::int as current_month_salary,
           coalesce(sum(ps.gross_salary_amount) filter (
             where pc.cycle_month = (date_trunc('month', current_date) - interval '1 month')::date
           ), 0)::int as previous_month_salary
           ,
           coalesce(sum(ps.gross_salary_amount) filter (
             where pc.cycle_month = (date_trunc('month', current_date) - interval '2 month')::date
           ), 0)::int as two_months_ago_salary
         from payroll_summaries ps
         join payroll_cycles pc on pc.id = ps.payroll_cycle_id
         where ps.technician_user_id = $1
           and pc.cycle_month >= date_trunc('year', current_date)::date
           and pc.cycle_month < (date_trunc('year', current_date) + interval '1 year')::date`,
        [technicianUserId]
      ),
      query(
        `with month_series as (
           select generate_series(1, 12) as month_no
         ),
         monthly_salary as (
           select
             extract(month from pc.cycle_month)::int as month_no,
             coalesce(sum(ps.gross_salary_amount), 0)::int as revenue
           from payroll_summaries ps
           join payroll_cycles pc on pc.id = ps.payroll_cycle_id
           where ps.technician_user_id = $1
             and pc.cycle_month >= date_trunc('year', current_date)::date
             and pc.cycle_month < (date_trunc('year', current_date) + interval '1 year')::date
           group by 1
         )
         select
           ms.month_no as sort_order,
           ms.month_no::text || '月' as label,
           coalesce(ms2.revenue, 0)::int as revenue
         from month_series ms
         left join monthly_salary ms2 on ms2.month_no = ms.month_no
         order by ms.month_no asc`,
        [technicianUserId]
      ),
      query(
        `select
           ps.id as payroll_summary_id,
           pc.cycle_month,
           ps.gross_salary_amount,
           ps.completed_order_count,
           ps.payment_status,
           ps.paid_at
         from payroll_summaries ps
         join payroll_cycles pc on pc.id = ps.payroll_cycle_id
         where ps.technician_user_id = $1
           and pc.cycle_month >= date_trunc('year', current_date)::date
           and pc.cycle_month < (date_trunc('year', current_date) + interval '1 year')::date
         order by pc.cycle_month desc
         limit 10`,
        [technicianUserId]
      )
    ]);

    const summary = mapMoneyFields(summaryResult.rows[0] || {}, [
      "total_salary",
      "total_commission_income",
      "current_month_salary",
      "previous_month_salary",
      "two_months_ago_salary"
    ]);
    const trend = (trendResult.rows || []).map((row) => mapMoneyFields(row, ["revenue"]));
    const maxIndex = resolveRevenueMaxIndex(trend);
    const salaryMonthCount = Number(summary.salary_month_count || 0);
    const averageMonthlySalary = salaryMonthCount > 0
      ? Number(summary.total_salary || 0) / salaryMonthCount
      : 0;

    return ok(res, {
      period: "salary",
      label: "上月工资",
      total: summary.previous_month_salary || 0,
      orders: summary.completed_order_count || 0,
      amount: averageMonthlySalary,
      amountLabel: "平均月工资",
      trendText: buildPeriodTrendText(summary.previous_month_salary, summary.two_months_ago_salary, "前一月工资"),
      chart: trend.map((t) => t.revenue),
      chartLabels: trend.map((t) => t.label),
      chartMaxIndex: maxIndex,
      details: (detailsResult.rows || []).map((row) => mapMoneyFields(row, ["gross_salary_amount"])).map((row) => ({
        id: row.payroll_summary_id,
        name: `${formatCycleMonthText(row.cycle_month)}工资单`,
        time: row.payment_status === "paid" ? "已发放" : "待发放",
        duration: `${row.completed_order_count || 0} 单`,
        amount: row.gross_salary_amount || 0,
        status: row.payment_status,
        icon: "payments"
      }))
    });
  }

  if (period === "year") {
    const [summaryResult, trendResult] = await Promise.all([
      query(
        `select
           count(*) filter (where o.status = 'completed')::int as completed_order_count,
           coalesce(sum(coalesce(poi.commission_amount, 0) + coalesce(poi.designated_bonus_amount, 0)) filter (where o.status = 'completed'), 0)::int as total_income,
           coalesce(sum(o.actual_amount) filter (where o.status = 'completed'), 0)::int as total_service_amount,
           count(distinct extract(year from o.start_time)) filter (where o.status = 'completed')::int as active_year_count,
           coalesce(sum(coalesce(poi.commission_amount, 0) + coalesce(poi.designated_bonus_amount, 0)) filter (
             where o.status = 'completed'
               and o.start_time >= date_trunc('year', current_date)
               and o.start_time < date_trunc('year', current_date) + interval '1 year'
           ), 0)::int as current_year_income,
           coalesce(sum(o.actual_amount) filter (
             where o.status = 'completed'
               and o.start_time >= date_trunc('year', current_date)
               and o.start_time < date_trunc('year', current_date) + interval '1 year'
           ), 0)::int as current_year_service_amount,
           coalesce(sum(coalesce(poi.commission_amount, 0) + coalesce(poi.designated_bonus_amount, 0)) filter (
             where o.status = 'completed'
               and o.start_time >= date_trunc('year', current_date) - interval '1 year'
               and o.start_time < date_trunc('year', current_date)
           ), 0)::int as previous_year_income
         from orders o
         left join payroll_order_items poi on poi.order_id = o.id
         where o.technician_user_id = $1`,
        [technicianUserId]
      ),
      query(
        `with bounds as (
           select coalesce(
             min(date_trunc('year', start_time)::date),
             date_trunc('year', current_date)::date
           ) as first_year
           from orders
           where technician_user_id = $1
             and status = 'completed'
         ),
         year_series as (
           select generate_series(
             (select first_year from bounds),
             date_trunc('year', current_date)::date,
             interval '1 year'
           )::date as year_start
         ),
         yearly_orders as (
           select
             date_trunc('year', o.start_time)::date as year_start,
             coalesce(sum(coalesce(poi.commission_amount, 0) + coalesce(poi.designated_bonus_amount, 0)), 0)::int as revenue
           from orders o
           left join payroll_order_items poi on poi.order_id = o.id
           where o.technician_user_id = $1
             and o.status = 'completed'
           group by 1
         )
         select
           extract(year from ys.year_start)::int as sort_order,
           extract(year from ys.year_start)::int::text as label,
           coalesce(yo.revenue, 0)::int as revenue
         from year_series ys
         left join yearly_orders yo on yo.year_start = ys.year_start
         order by ys.year_start asc`,
        [technicianUserId]
      )
    ]);

    const summary = mapMoneyFields(summaryResult.rows[0] || {}, [
      "total_income",
      "total_service_amount",
      "current_year_income",
      "current_year_service_amount",
      "previous_year_income"
    ]);
    const trend = (trendResult.rows || []).map((row) => mapMoneyFields(row, ["revenue"]));
    const maxIndex = resolveRevenueMaxIndex(trend);
    const activeYearCount = Number(summary.active_year_count || 0);
    const yearlyAverageRevenue = activeYearCount > 0
      ? Number(summary.total_income || 0) / activeYearCount
      : 0;

    return ok(res, {
      period: "year",
      label: "本年度累计收益",
      total: summary.current_year_income || 0,
      orders: summary.completed_order_count || 0,
      amount: summary.current_year_service_amount || 0,
      amountLabel: "服务总额",
      trendText: buildPeriodTrendText(summary.current_year_income, summary.previous_year_income, "去年"),
      chart: trend.map((t) => t.revenue),
      chartLabels: trend.map((t) => t.label),
      chartMaxIndex: maxIndex,
      details: trend.slice().reverse().filter((item) => Number(item.revenue || 0) > 0).slice(0, 10).map((item) => ({
        id: item.label,
        name: `${item.label}年度累计`,
        time: "全年",
        amount: item.revenue || 0,
        icon: "bar_chart"
      }))
    });
  }

  const [summaryResult, trendResult, detailsResult] = await Promise.all([
    query(
      `select
         count(*) filter (
           where o.status = 'completed'
             and o.start_time >= date_trunc('month', current_date)
             and o.start_time < date_trunc('month', current_date) + interval '1 month'
         )::int as completed_order_count,
         coalesce(sum(coalesce(poi.commission_amount, 0) + coalesce(poi.designated_bonus_amount, 0)) filter (where o.status = 'completed'), 0)::int as total_income,
         coalesce(sum(o.actual_amount) filter (
           where o.status = 'completed'
             and o.start_time >= date_trunc('month', current_date)
             and o.start_time < date_trunc('month', current_date) + interval '1 month'
         ), 0)::int as total_service_amount,
         coalesce(sum(coalesce(poi.commission_amount, 0) + coalesce(poi.designated_bonus_amount, 0)) filter (
           where o.status = 'completed'
             and o.start_time >= date_trunc('month', current_date)
             and o.start_time < date_trunc('month', current_date) + interval '1 month'
         ), 0)::int as current_month_income,
         coalesce(sum(coalesce(poi.commission_amount, 0) + coalesce(poi.designated_bonus_amount, 0)) filter (
           where o.status = 'completed'
             and o.start_time >= date_trunc('month', current_date) - interval '1 month'
             and o.start_time < date_trunc('month', current_date)
         ), 0)::int as previous_month_income
       from orders o
       left join payroll_order_items poi on poi.order_id = o.id
       where o.technician_user_id = $1
         and o.start_time >= date_trunc('year', current_date)
         and o.start_time < date_trunc('year', current_date) + interval '1 year'`,
      [technicianUserId]
    ),
    query(
      `with month_series as (
         select generate_series(1, 12) as month_no
       ),
       monthly_orders as (
         select
           extract(month from o.start_time)::int as month_no,
           coalesce(sum(coalesce(poi.commission_amount, 0) + coalesce(poi.designated_bonus_amount, 0)) filter (where o.status = 'completed'), 0)::int as revenue
         from orders o
         left join payroll_order_items poi on poi.order_id = o.id
         where o.technician_user_id = $1
           and o.start_time >= date_trunc('year', current_date)
           and o.start_time < date_trunc('year', current_date) + interval '1 year'
         group by 1
       )
       select
         ms.month_no as sort_order,
         ms.month_no::text || '月' as label,
         coalesce(mo.revenue, 0)::int as revenue
       from month_series ms
       left join monthly_orders mo on mo.month_no = ms.month_no
       order by ms.month_no asc`,
      [technicianUserId]
    ),
    query(
      `select
         date_trunc('day', o.start_time)::date as service_date,
         count(*)::int as completed_order_count,
         coalesce(sum(coalesce(poi.commission_amount, 0) + coalesce(poi.designated_bonus_amount, 0)), 0)::int as daily_income
       from orders o
       left join payroll_order_items poi on poi.order_id = o.id
       where o.technician_user_id = $1
         and o.start_time >= date_trunc('month', current_date)
         and o.start_time < date_trunc('month', current_date) + interval '1 month'
         and o.status = 'completed'
       group by 1
       having coalesce(sum(coalesce(poi.commission_amount, 0) + coalesce(poi.designated_bonus_amount, 0)), 0) > 0
       order by service_date desc
       limit 31`,
      [technicianUserId]
    )
  ]);

  const summary = mapMoneyFields(summaryResult.rows[0] || {}, [
    "total_income",
    "total_service_amount",
    "current_month_income",
    "previous_month_income"
  ]);
  const trend = (trendResult.rows || []).map((row) => mapMoneyFields(row, ["revenue"]));
  const maxIndex = resolveRevenueMaxIndex(trend);
  const yearToDateAverage = Number(summary.completed_order_count || 0) > 0
    ? Number(summary.total_income || 0) / Number(summary.completed_order_count || 1)
    : 0;

  return ok(res, {
    period: "month",
    label: "本月累计收益",
    total: summary.current_month_income || 0,
    orders: summary.completed_order_count || 0,
    amount: summary.total_service_amount || 0,
    amountLabel: "服务总额",
    trendText: buildPeriodTrendText(summary.current_month_income, summary.previous_month_income, "上月"),
    chart: trend.map((t) => t.revenue),
    chartLabels: trend.map((t) => t.label),
    chartMaxIndex: maxIndex,
    details: (detailsResult.rows || []).map((row) => mapMoneyFields(row, ["daily_income"])).map((row) => ({
      id: row.service_date,
      name: row.service_date ? new Date(row.service_date).toLocaleDateString("zh-CN", { month: "short", day: "numeric" }) : "当日收益",
      time: `${Number(row.completed_order_count || 0)} 单完成`,
      amount: Number(row.daily_income || 0),
      icon: "calendar_today"
    }))
  });
}));

router.get("/technician/earnings/:payrollSummaryId", requireTechnicianContext, wrap(async (req, res) => {
  const { technicianUserId } = req.ctx;
  const { payrollSummaryId } = req.params;

  const [summaryResult, ordersResult] = await Promise.all([
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
       where ps.id = $1 and ps.technician_user_id = $2
       limit 1`,
      [payrollSummaryId, technicianUserId]
    ),
    query(
      `select
         poi.id,
         poi.order_id,
         poi.order_type,
         poi.service_amount,
         poi.commission_rate,
         poi.commission_amount,
         poi.designated_bonus_amount,
         o.order_no,
         o.customer_name,
         o.room_code,
         o.start_time,
         o.end_time
       from payroll_order_items poi
       join orders o on o.id = poi.order_id
       where poi.payroll_summary_id = $1
       order by o.start_time desc`,
      [payrollSummaryId]
    )
  ]);

  if (!summaryResult.rows[0]) {
    return fail(res, "Payroll summary not found", 404);
  }

  return ok(res, {
    summary: mapMoneyFields(summaryResult.rows[0], [
      "base_salary_amount",
      "scheduled_commission_amount",
      "designated_commission_amount",
      "designated_bonus_total",
      "gross_salary_amount"
    ]),
    orders: ordersResult.rows.map((row) => mapMoneyFields(row, [
      "service_amount",
      "commission_amount",
      "designated_bonus_amount"
    ]))
  });
}));

router.get("/technician/profile", requireTechnicianContext, wrap(async (req, res) => {
  const { technicianUserId } = req.ctx;
  const result = await query(
    `select
       user_id as technician_user_id,
       name,
       avatar_url,
       employee_no,
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
}));

router.put("/technician/profile", requireTechnicianContext, wrap(async (req, res) => {
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
}));

router.post("/technician/status", requireTechnicianContext, wrap(async (req, res) => {
  const { technicianUserId } = req.ctx;
  const { attendanceStatus, serviceStatus, shopId } = req.body || {};

  if (!attendanceStatus || !serviceStatus) {
    return fail(res, "attendanceStatus and serviceStatus are required", 400);
  }

  // 获取技师所属门店
  let resolvedShopId = shopId;
  if (!resolvedShopId) {
    const membershipResult = await query(
      `select shop_id from shop_staff_memberships
       where user_id = $1 and role_in_shop = 'technician' and membership_status = 'active'
       limit 1`,
      [technicianUserId]
    );
    resolvedShopId = membershipResult.rows[0]?.shop_id;
  }

  if (!resolvedShopId) {
    return fail(res, "Shop not found. Please join a shop first.", 400);
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
       changed_by,
       changed_at`,
    [resolvedShopId, technicianUserId, attendanceStatus, serviceStatus]
  );

  return ok(res, {
    statusLog: result.rows[0]
  });
}));

router.get("/technician/membership", requireTechnicianContext, wrap(async (req, res) => {
  const { technicianUserId } = req.ctx;
  const [activeMembershipResult, applicationHistoryResult, membershipHistoryResult] = await Promise.all([
    query(
      `select
         sm.id,
         sm.shop_id,
         s.name as shop_name,
         s.address as shop_address,
         s.opening_hours as shop_opening_hours,
         s.contact_phone as shop_contact_phone,
         sm.membership_status,
         sm.joined_at,
         sm.left_at,
         la.id as leave_application_id,
         la.status as leave_application_status,
         la.applied_at as leave_application_applied_at,
         la.review_note as leave_application_review_note,
         la.reason as leave_application_reason
       from shop_staff_memberships sm
       join shops s on s.id = sm.shop_id
       left join lateral (
         select
           id,
           status,
           applied_at,
           review_note,
           reason
         from shop_leave_applications
         where shop_id = sm.shop_id
           and technician_user_id = sm.user_id
         order by
           case status when 'pending' then 0 when 'rejected' then 1 when 'approved' then 2 else 3 end,
           applied_at desc
         limit 1
       ) la on true
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
    ),
    query(
      `select
         sm.id,
         sm.shop_id,
         s.name as shop_name,
         s.address as shop_address,
         s.opening_hours as shop_opening_hours,
         s.contact_phone as shop_contact_phone,
         s.manager_name as shop_manager_name,
         sm.membership_status,
         sm.joined_at,
         sm.left_at
       from shop_staff_memberships sm
       join shops s on s.id = sm.shop_id
       where sm.user_id = $1
         and sm.role_in_shop = 'technician'
       order by
         case sm.membership_status when 'active' then 0 else 1 end,
         coalesce(sm.left_at, sm.joined_at, sm.created_at) desc`,
      [technicianUserId]
    )
  ]);

  return ok(res, {
    currentMembership: activeMembershipResult.rows[0] || null,
    applicationHistory: applicationHistoryResult.rows,
    membershipHistory: membershipHistoryResult.rows
  });
}));

router.get("/technician/shops/:shopId/join-info", requireTechnicianContext, wrap(async (req, res) => {
  const result = await query(
    `select
       id,
       name,
       address,
       contact_phone
     from shops
     where id = $1`,
    [req.params.shopId]
  );

  const shop = result.rows[0];
  if (!shop) {
    return fail(res, "Shop not found", 404);
  }

  return ok(res, { shop });
}));

router.get("/technician/shop/:shopId/detail", requireTechnicianContext, wrap(async (req, res) => {
  const result = await query(
    `select
       id,
       name,
       manager_name,
       contact_phone,
       address,
       opening_hours,
       subscription_plan,
       subscription_status,
       subscription_expires_at,
       qr_code_url,
       created_at
     from shops
     where id = $1`,
    [req.params.shopId]
  );

  const shop = result.rows[0];
  if (!shop) {
    return fail(res, "Shop not found", 404);
  }

  // 获取技师数量
  const techResult = await query(
    `select count(*) as technician_count
     from shop_staff_memberships
     where shop_id = $1 and role_in_shop = 'technician' and membership_status = 'active'`,
    [req.params.shopId]
  );
  shop.technician_count = parseInt(techResult.rows[0].technician_count, 10);

  // 获取服务项目数量
  const serviceResult = await query(
    `select count(*) as service_count
     from service_items
     where shop_id = $1 and is_active = true`,
    [req.params.shopId]
  );
  shop.service_count = parseInt(serviceResult.rows[0].service_count, 10);

  // 获取房间数量
  const roomResult = await query(
    `select count(*) as room_count
     from rooms
     where shop_id = $1 and is_active = true`,
    [req.params.shopId]
  );
  shop.room_count = parseInt(roomResult.rows[0].room_count, 10);

  return ok(res, { shop });
}));

router.post("/technician/orders/:orderId/start", requireTechnicianContext, wrap(async (req, res) => {
  const { technicianUserId } = req.ctx;
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
         and technician_user_id = $2
         and status = 'pending'
       returning
         id, shop_id`,
      [req.params.orderId, technicianUserId]
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
      [order.shop_id, technicianUserId, technicianUserId]
    );

    await client.query("commit");

    return ok(res, {
      order: await findTechnicianOrder(order.id, technicianUserId)
    });
  } catch (error) {
    await client.query("rollback");
    throw error;
  } finally {
    client.release();
  }
}));

router.post("/technician/orders/:orderId/complete", requireTechnicianContext, wrap(async (req, res) => {
  const { technicianUserId } = req.ctx;
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
         and technician_user_id = $2
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
      [req.params.orderId, technicianUserId]
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
      [order.shop_id, technicianUserId, technicianUserId]
    );

    await client.query("commit");

    return ok(res, {
      order: await findTechnicianOrder(order.id, technicianUserId)
    });
  } catch (error) {
    await client.query("rollback");
    throw error;
  } finally {
    client.release();
  }
}));

router.post("/technician/shop-applications", requireTechnicianContext, wrap(async (req, res) => {
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

  const existingApplicationResult = await query(
    `select id, shop_id, technician_user_id, status, applied_at
     from shop_join_applications
     where shop_id = $1
       and technician_user_id = $2
       and status = 'pending'
     limit 1`,
    [shopId, technicianUserId]
  );

  if (existingApplicationResult.rows[0]) {
    return ok(res, {
      application: existingApplicationResult.rows[0],
      alreadyPending: true
    });
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
}));

router.get("/technician/applications", requireTechnicianContext, wrap(async (req, res) => {
  const { technicianUserId } = req.ctx;

  const result = await query(
    `select 
       a.id,
       a.shop_id,
       a.status,
       a.applied_at,
       a.review_note,
       s.name as shop_name,
       s.address as shop_address
     from shop_join_applications a
     join shops s on s.id = a.shop_id
     where a.technician_user_id = $1
     order by a.applied_at desc`,
    [technicianUserId]
  );

  return ok(res, {
    applications: result.rows
  });
}));

async function findTechnicianOrder(orderId, technicianUserId) {
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
       o.shop_id,
       o.technician_user_id,
       si.name as service_name,
       si.description as service_description,
       si.duration_minutes as service_duration_minutes,
       si.list_price,
       r.name as room_name,
       c.phone as customer_phone
     from orders o
     left join service_items si on si.id = o.service_item_id
     left join rooms r on r.id = o.room_id
     left join customers c on c.id = o.customer_id
     where o.id = $1
       and o.technician_user_id = $2`,
    [orderId, technicianUserId]
  );
  return result.rows[0] || null;
}

router.get("/technician/orders/:orderId", requireTechnicianContext, wrap(async (req, res) => {
  const { technicianUserId } = req.ctx;
  const orderId = req.params.orderId;
  
  const order = await findTechnicianOrder(orderId, technicianUserId);
  if (!order) {
    return fail(res, "Order not found", 404);
  }
  
  return ok(res, {
    order: mapMoneyFields(order, ["service_amount", "actual_amount", "list_price"])
  });
}));

router.post("/technician/membership/leave", requireTechnicianContext, wrap(async (req, res) => {
  const { technicianUserId } = req.ctx;
  const { reason } = req.body || {};
  const membershipResult = await query(
    `select id, shop_id, membership_status
     from shop_staff_memberships
     where user_id = $1
       and role_in_shop = 'technician'
       and membership_status = 'active'
     limit 1`,
    [technicianUserId]
  );

  const membership = membershipResult.rows[0];
  if (!membership) {
    return fail(res, "No active membership found", 404);
  }

  const existingApplicationResult = await query(
    `select id, shop_id, technician_user_id, membership_id, status, applied_at, reason
     from shop_leave_applications
     where shop_id = $1
       and technician_user_id = $2
       and status = 'pending'
     limit 1`,
    [membership.shop_id, technicianUserId]
  );

  if (existingApplicationResult.rows[0]) {
    return ok(res, {
      application: existingApplicationResult.rows[0],
      alreadyPending: true,
      message: "解约申请已提交，等待门店审核"
    });
  }

  const result = await query(
    `insert into shop_leave_applications (
       shop_id,
       technician_user_id,
       membership_id,
       status,
       reason
     ) values ($1, $2, $3, 'pending', $4)
     returning id, shop_id, technician_user_id, membership_id, status, applied_at, reason`,
    [membership.shop_id, technicianUserId, membership.id, reason || null]
  );

  return ok(res, {
    application: result.rows[0],
    message: "解约申请已提交，等待门店审核"
  }, 201);
}));

router.get("/technician/shops", requireTechnicianContext, wrap(async (req, res) => {
  const { q, limit = "20" } = req.query || {};
  const searchLimit = Math.min(parseInt(limit, 10) || 20, 100);

  let sql = `
    select
      s.id,
      s.name,
      s.address,
      s.contact_phone,
      s.opening_hours,
      count(distinct sm.user_id) filter (where sm.membership_status = 'active')::int as technician_count
    from shops s
    left join shop_staff_memberships sm on sm.shop_id = s.id and sm.role_in_shop = 'technician'
    where s.subscription_status = 'active'
  `;
  const params = [];

  if (q && q.trim()) {
    sql += ` and (s.name ilike $1 or s.address ilike $1)`;
    params.push(`%${q.trim()}%`);
  }

  sql += `
    group by s.id
    order by s.created_at desc
    limit $${params.length + 1}
  `;
  params.push(searchLimit);

  const result = await query(sql, params);

  return ok(res, {
    shops: result.rows.map((shop) => ({
      ...shop,
      tags: ["足疗", "推拿"],
      icon: "storefront"
    }))
  });
}));

module.exports = router;
