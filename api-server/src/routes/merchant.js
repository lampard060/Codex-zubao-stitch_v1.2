const express = require("express");
const { ok } = require("../lib/respond");
const { query } = require("../lib/db");
const { requireAuth } = require("../middleware/auth");
const { requireMerchantShopAccess } = require("../middleware/authorization");
const { requireShopContext } = require("../lib/request-context");
const { mapMoneyFields } = require("../lib/formatters");
const { resolveMonthRange, resolveAnalyticsRange } = require("../lib/date-range");
const { wrap } = require("../lib/async-handler");

const router = express.Router();

router.use("/merchant", requireAuth, requireMerchantShopAccess);

router.get("/merchant/dashboard", requireShopContext, wrap(async (req, res) => {
  const { shopId } = req.ctx;
  const { monthStart, monthEnd, monthLabel } = resolveMonthRange();

  const [shopResult, todayMetricsResult, monthMetricsResult, ongoingOrdersResult, waitingTechniciansResult, rankingResult] = await Promise.all([
    query(
      `select id, name, manager_name, contact_phone, subscription_plan, subscription_status
       from shops
       where id = $1`,
      [shopId]
    ),
    query(
      `select
         count(*)::int as today_order_count,
         coalesce(sum(actual_amount) filter (where o.status = 'completed'), 0)::int as today_revenue,
         count(*) filter (where o.status = 'pending')::int as pending_order_count,
         count(*) filter (where o.status = 'in_service')::int as in_service_count
       from orders o
       left join service_items si on si.id = o.service_item_id
       where o.shop_id = $1
         and start_time >= current_date
         and start_time < current_date + interval '1 day'`,
      [shopId]
    ),
    query(
      `select
         count(*) filter (where status = 'completed')::int as completed_order_count,
         coalesce(sum(actual_amount) filter (where status = 'completed'), 0)::int as month_revenue
       from orders
       where shop_id = $1
         and start_time >= $2
         and start_time < $3`,
      [shopId, monthStart, monthEnd]
    ),
    query(
      `select
         o.id,
         o.order_no,
         o.room_code,
         o.customer_name,
         o.order_type,
         o.status,
         o.start_time,
         o.duration_minutes,
         o.technician_user_id,
         tp.name as technician_name,
         si.name as service_name,
         r.name as room_name
       from orders o
       join technician_profiles tp on tp.user_id = o.technician_user_id
       left join service_items si on si.id = o.service_item_id
       left join rooms r on r.id = o.room_id
       where o.shop_id = $1
         and o.status in ('pending', 'in_service')
       order by
         case o.status when 'in_service' then 0 else 1 end,
         o.start_time asc nulls last,
         o.created_at asc
       limit 5`,
      [shopId]
    ),
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
         and coalesce(ls.attendance_status::text, 'off_duty') = 'on_duty'
         and coalesce(ls.service_status::text, 'available') = 'available'
       order by tp.created_at asc
       limit 6`,
      [shopId]
    ),
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
         count(o.id)::int as completed_order_count,
         coalesce(sum(o.actual_amount), 0)::int as contributed_revenue,
         coalesce(ls.attendance_status::text, 'off_duty') as attendance_status,
         coalesce(ls.service_status::text, 'available') as service_status
       from shop_staff_memberships sm
       join technician_profiles tp on tp.user_id = sm.user_id
       left join latest_status ls on ls.technician_user_id = sm.user_id
       left join orders o
         on o.shop_id = sm.shop_id
        and o.technician_user_id = sm.user_id
        and o.status = 'completed'
        and o.start_time >= $2
        and o.start_time < $3
       where sm.shop_id = $1
         and sm.role_in_shop = 'technician'
         and sm.membership_status = 'active'
         and coalesce(ls.attendance_status::text, 'off_duty') != 'resting'
       group by tp.user_id, tp.name, tp.avatar_url, ls.attendance_status, ls.service_status
       order by contributed_revenue desc, completed_order_count desc, tp.name asc
       limit 3`,
      [shopId, monthStart, monthEnd]
    )
  ]);

  return ok(res, {
    month: monthLabel,
    shop: shopResult.rows[0] || null,
    today: mapMoneyFields(todayMetricsResult.rows[0] || {}, ["today_revenue"]),
    monthSummary: mapMoneyFields(monthMetricsResult.rows[0] || {}, ["month_revenue"]),
    ongoingOrders: ongoingOrdersResult.rows,
    waitingTechnicians: waitingTechniciansResult.rows,
    technicianRanking: rankingResult.rows.map((row) => mapMoneyFields(row, ["contributed_revenue"]))
  });
}));

router.get("/merchant/analytics", requireShopContext, wrap(async (req, res) => {
  const { shopId } = req.ctx;
  const range = resolveAnalyticsRange(req.query.period, req.query.month);

  let trendQuery = null;
  let trendParams = null;

  if (range.chartMode === "hour") {
    trendQuery = `
      with hour_series as (
        select generate_series(10, 20, 2) as bucket_hour
      ),
      hourly_orders as (
        select
          extract(hour from start_time)::int as bucket_hour,
          sum(actual_amount)::int as revenue
        from orders
        where shop_id = $1
          and status = 'completed'
          and start_time >= $2
          and start_time < $3
        group by 1
      )
      select
        hs.bucket_hour as sort_order,
        lpad(hs.bucket_hour::text, 2, '0') || ':00' as label,
        coalesce(ho.revenue, 0)::int as revenue
      from hour_series hs
      left join hourly_orders ho on ho.bucket_hour = hs.bucket_hour
      order by hs.bucket_hour asc`;
    trendParams = [shopId, range.rangeStart, range.rangeEnd];
  } else if (range.chartMode === "month") {
    trendQuery = `
      with month_series as (
        select generate_series(1, 12) as month_no
      ),
      monthly_orders as (
        select
          extract(month from start_time)::int as month_no,
          sum(actual_amount)::int as revenue
        from orders
        where shop_id = $1
          and status = 'completed'
          and start_time >= $2
          and start_time < $3
        group by 1
      )
      select
        ms.month_no as sort_order,
        ms.month_no::text || '月' as label,
        coalesce(mo.revenue, 0)::int as revenue
      from month_series ms
      left join monthly_orders mo on mo.month_no = ms.month_no
      order by ms.month_no asc`;
    trendParams = [shopId, range.rangeStart, range.rangeEnd];
  } else {
    trendQuery = `
      with week_series as (
        select generate_series(0, 4) as week_index
      ),
      weekly_orders as (
        select
          least(4, floor(extract(day from start_time - $2::timestamptz) / 7))::int as week_index,
          sum(actual_amount)::int as revenue
        from orders
        where shop_id = $1
          and status = 'completed'
          and start_time >= $2
          and start_time < $3
        group by 1
      )
      select
        ws.week_index + 1 as sort_order,
        '第' || (ws.week_index + 1)::text || '周' as label,
        coalesce(wo.revenue, 0)::int as revenue
      from week_series ws
      left join weekly_orders wo on wo.week_index = ws.week_index
      order by ws.week_index asc`;
    trendParams = [shopId, range.rangeStart, range.rangeEnd];
  }

  const [trendResult, structureResult, payrollSummaryResult, technicianContributionResult] = await Promise.all([
    query(trendQuery, trendParams),
    query(
      `with revenue as (
         select coalesce(sum(actual_amount), 0)::int as gross_revenue
         from orders
         where shop_id = $1
           and status = 'completed'
           and start_time >= $2
           and start_time < $3
       ),
       payroll as (
         select coalesce(sum(ps.gross_salary_amount), 0)::int as payroll_cost
         from payroll_cycles pc
         join payroll_summaries ps on ps.payroll_cycle_id = pc.id
         where pc.shop_id = $1
           and pc.cycle_month >= $2::date
           and pc.cycle_month < $3::date
       )
       select
         revenue.gross_revenue,
         payroll.payroll_cost,
         (revenue.gross_revenue - payroll.payroll_cost)::int as net_revenue
       from revenue, payroll`,
      [shopId, range.rangeStart, range.rangeEnd]
    ),
    query(
      `select
         ps.id as payroll_summary_id,
         tp.user_id as technician_user_id,
         tp.name,
         tp.avatar_url,
         ps.base_salary_amount,
         ps.scheduled_commission_amount,
         ps.designated_commission_amount,
         ps.designated_bonus_total,
         ps.gross_salary_amount
       from payroll_cycles pc
       join payroll_summaries ps on ps.payroll_cycle_id = pc.id
       join technician_profiles tp on tp.user_id = ps.technician_user_id
       where pc.shop_id = $1
         and pc.cycle_month >= $2::date
         and pc.cycle_month < $3::date
       order by ps.gross_salary_amount desc, tp.name asc
       limit 4`,
      [shopId, range.rangeStart, range.rangeEnd]
    ),
    query(
      `select
         tp.user_id as technician_user_id,
         tp.name,
         tp.avatar_url,
         count(o.id)::int as completed_order_count,
         coalesce(sum(o.actual_amount), 0)::int as service_revenue
       from shop_staff_memberships sm
       join technician_profiles tp on tp.user_id = sm.user_id
       left join orders o
         on o.shop_id = sm.shop_id
        and o.technician_user_id = sm.user_id
        and o.status = 'completed'
        and o.start_time >= $2
        and o.start_time < $3
       where sm.shop_id = $1
         and sm.role_in_shop = 'technician'
         and sm.membership_status = 'active'
       group by tp.user_id, tp.name, tp.avatar_url
       order by service_revenue desc, completed_order_count desc, tp.name asc
       limit 3`,
      [shopId, range.rangeStart, range.rangeEnd]
    )
  ]);

  return ok(res, {
    period: range.period,
    periodLabel: range.label,
    chartMode: range.chartMode,
    trend: trendResult.rows.map((row) => mapMoneyFields(row, ["revenue"])),
    structure: mapMoneyFields(structureResult.rows[0] || {}, ["gross_revenue", "payroll_cost", "net_revenue"]),
    payrollSummary: payrollSummaryResult.rows.map((row) => mapMoneyFields(row, [
      "base_salary_amount",
      "scheduled_commission_amount",
      "designated_commission_amount",
      "designated_bonus_total",
      "gross_salary_amount"
    ])),
    technicianContributionRanking: technicianContributionResult.rows.map((row) => mapMoneyFields(row, ["service_revenue"]))
  });
}));

router.get("/merchant/settings", requireShopContext, wrap(async (req, res) => {
  const { shopId } = req.ctx;
  const [shopResult, statsResult] = await Promise.all([
    query(
      `select
         id,
         name,
         manager_name,
         contact_phone,
         address,
         qr_code_url,
         opening_hours,
         subscription_plan,
         subscription_status,
         subscription_expires_at
       from shops
       where id = $1`,
      [shopId]
    ),
    query(
      `select
         (select count(*) from rooms where shop_id = $1 and is_active = true)::int as total_rooms,
         (select count(r.id) from rooms r where r.shop_id = $1 and r.is_active = true and not exists (select 1 from orders o where o.room_id = r.id and o.status = 'in_service'))::int as available_rooms,
         (select count(*) from customers where shop_id = $1 and is_active = true)::int as total_customers,
         (select count(*) from service_items where shop_id = $1 and is_active = true)::int as total_services,
         (select count(*) from shop_join_applications where shop_id = $1 and status = 'pending')::int as pending_applications`,
      [shopId]
    )
  ]);

  return ok(res, {
    shop: shopResult.rows[0] || null,
    stats: statsResult.rows[0] || {}
  });
}));

router.put("/merchant/settings", requireShopContext, wrap(async (req, res) => {
  const { shopId } = req.ctx;
  const { name, managerName, contactPhone, address, qrCodeUrl, openingHours } = req.body || {};
  const result = await query(
    `update shops
     set
       name = coalesce($2, name),
       manager_name = coalesce($3, manager_name),
       contact_phone = coalesce($4, contact_phone),
       address = coalesce($5, address),
       qr_code_url = coalesce($6, qr_code_url),
       opening_hours = coalesce($7, opening_hours),
       updated_at = now()
     where id = $1
     returning
       id,
       name,
       manager_name,
       contact_phone,
       address,
       qr_code_url,
       opening_hours,
       subscription_plan,
       subscription_status,
       subscription_expires_at`,
    [shopId, name, managerName, contactPhone, address, qrCodeUrl, openingHours]
  );

  return ok(res, {
    shop: result.rows[0] || null
  });
}));

module.exports = router;
