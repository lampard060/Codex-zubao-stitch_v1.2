const express = require("express");
const { ok, fail } = require("../lib/respond");
const { pool, query } = require("../lib/db");
const { requireShopContext, requireUserContext } = require("../lib/request-context");
const { mapMoneyFields } = require("../lib/formatters");
const { resolveMonthRange } = require("../lib/date-range");

const router = express.Router();

function normalizeRule(rule) {
  if (!rule) {
    return null;
  }

  return {
    ...rule,
    base_salary: Number(rule.base_salary || 0),
    scheduled_commission_rate: Number(rule.scheduled_commission_rate || 0),
    designated_commission_rate: Number(rule.designated_commission_rate || 0),
    designated_bonus_amount: Number(rule.designated_bonus_amount || 0)
  };
}

function calculateSummary(rule, orders) {
  const normalizedRule = normalizeRule(rule);
  const completedOrderCount = orders.length;
  const scheduledOrders = orders.filter((order) => order.order_type === "scheduled");
  const designatedOrders = orders.filter((order) => order.order_type === "designated");
  const scheduledAmountTotal = scheduledOrders.reduce((sum, order) => sum + Number(order.service_amount || 0), 0);
  const designatedAmountTotal = designatedOrders.reduce((sum, order) => sum + Number(order.service_amount || 0), 0);
  const scheduledCommissionAmount = Math.round(scheduledAmountTotal * normalizedRule.scheduled_commission_rate);
  const designatedCommissionAmount = Math.round(designatedAmountTotal * normalizedRule.designated_commission_rate);
  const designatedBonusTotal = designatedOrders.length * normalizedRule.designated_bonus_amount;
  const baseSalaryAmount = normalizedRule.base_salary;
  const grossSalaryAmount = baseSalaryAmount + scheduledCommissionAmount + designatedCommissionAmount + designatedBonusTotal;

  return {
    ruleSnapshot: normalizedRule,
    completedOrderCount,
    scheduledAmountTotal,
    designatedAmountTotal,
    scheduledCommissionAmount,
    designatedCommissionAmount,
    designatedBonusTotal,
    baseSalaryAmount,
    grossSalaryAmount
  };
}

router.get("/merchant/payroll/overview", requireShopContext, async (req, res) => {
  const { shopId } = req.ctx;
  const { monthStart, monthLabel } = resolveMonthRange(req.query.month);
  const result = await query(
    `with cycle as (
       select id, cycle_month
       from payroll_cycles
       where shop_id = $1
         and cycle_month = $2::date
       limit 1
     )
     select
       coalesce(sum(ps.gross_salary_amount), 0)::int as total_salary_amount,
       count(ps.id)::int as technician_count,
       coalesce(round(avg(ps.gross_salary_amount)), 0)::int as average_salary_amount,
       count(ps.id) filter (where ps.payment_status = 'paid')::int as paid_count,
       count(ps.id) filter (where ps.payment_status = 'pending')::int as pending_count
     from cycle c
     left join payroll_summaries ps on ps.payroll_cycle_id = c.id`,
    [shopId, monthStart.toISOString().slice(0, 10)]
  );

  return ok(res, {
    month: monthLabel,
    overview: mapMoneyFields(result.rows[0] || {}, ["total_salary_amount", "average_salary_amount"])
  });
});

router.get("/merchant/payroll/rules", requireShopContext, async (req, res) => {
  const { shopId } = req.ctx;
  const [defaultRuleResult, overrideRulesResult] = await Promise.all([
    query(
      `select
         id,
         shop_id,
         scope_type,
         base_salary,
         scheduled_commission_rate,
         designated_commission_rate,
         designated_bonus_amount,
         effective_from,
         effective_to,
         is_active
       from payroll_rules
       where shop_id = $1
         and scope_type = 'shop_default'
         and is_active = true
       order by effective_from desc
       limit 1`,
      [shopId]
    ),
    query(
      `select
         pr.id,
         pr.technician_user_id,
         tp.name,
         tp.avatar_url,
         pr.base_salary,
         pr.scheduled_commission_rate,
         pr.designated_commission_rate,
         pr.designated_bonus_amount,
         pr.effective_from,
         pr.effective_to,
         pr.is_active
       from payroll_rules pr
       join technician_profiles tp on tp.user_id = pr.technician_user_id
       where pr.shop_id = $1
         and pr.scope_type = 'technician_override'
         and pr.is_active = true
       order by pr.effective_from desc, tp.name asc`,
      [shopId]
    )
  ]);

  return ok(res, {
    defaultRule: mapMoneyFields(defaultRuleResult.rows[0] || {}, ["base_salary", "designated_bonus_amount"]),
    overrideRules: overrideRulesResult.rows.map((row) => mapMoneyFields(row, ["base_salary", "designated_bonus_amount"]))
  });
});

router.put("/merchant/payroll/rules/default", requireShopContext, async (req, res) => {
  const { shopId } = req.ctx;
  const {
    baseSalary,
    scheduledCommissionRate,
    designatedCommissionRate,
    designatedBonusAmount,
    effectiveFrom
  } = req.body || {};

  if ([baseSalary, scheduledCommissionRate, designatedCommissionRate, designatedBonusAmount].some((value) => value === undefined)) {
    return fail(res, "baseSalary, scheduledCommissionRate, designatedCommissionRate and designatedBonusAmount are required", 400);
  }

  await query(
    `update payroll_rules
     set
       is_active = false,
       effective_to = coalesce(effective_to, $2::date - interval '1 day'),
       updated_at = now()
     where shop_id = $1
       and scope_type = 'shop_default'
       and is_active = true`,
    [shopId, effectiveFrom || new Date().toISOString().slice(0, 10)]
  );

  const result = await query(
    `insert into payroll_rules (
       shop_id,
       scope_type,
       base_salary,
       scheduled_commission_rate,
       designated_commission_rate,
       designated_bonus_amount,
       effective_from,
       is_active
     ) values (
       $1, 'shop_default', $2, $3, $4, $5, $6::date, true
     )
     returning
       id,
       shop_id,
       scope_type,
       base_salary,
       scheduled_commission_rate,
       designated_commission_rate,
       designated_bonus_amount,
       effective_from,
       effective_to,
       is_active`,
    [
      shopId,
      baseSalary,
      scheduledCommissionRate,
      designatedCommissionRate,
      designatedBonusAmount,
      effectiveFrom || new Date().toISOString().slice(0, 10)
    ]
  );

  return ok(res, {
    defaultRule: mapMoneyFields(result.rows[0], ["base_salary", "designated_bonus_amount"])
  });
});

router.put("/merchant/payroll/rules/technicians/:technicianUserId", requireShopContext, async (req, res) => {
  const { shopId } = req.ctx;
  const {
    baseSalary,
    scheduledCommissionRate,
    designatedCommissionRate,
    designatedBonusAmount,
    effectiveFrom
  } = req.body || {};

  if ([baseSalary, scheduledCommissionRate, designatedCommissionRate, designatedBonusAmount].some((value) => value === undefined)) {
    return fail(res, "baseSalary, scheduledCommissionRate, designatedCommissionRate and designatedBonusAmount are required", 400);
  }

  await query(
    `update payroll_rules
     set
       is_active = false,
       effective_to = coalesce(effective_to, $3::date - interval '1 day'),
       updated_at = now()
     where shop_id = $1
       and technician_user_id = $2
       and scope_type = 'technician_override'
       and is_active = true`,
    [shopId, req.params.technicianUserId, effectiveFrom || new Date().toISOString().slice(0, 10)]
  );

  const result = await query(
    `insert into payroll_rules (
       shop_id,
       scope_type,
       technician_user_id,
       base_salary,
       scheduled_commission_rate,
       designated_commission_rate,
       designated_bonus_amount,
       effective_from,
       is_active
     ) values (
       $1, 'technician_override', $2, $3, $4, $5, $6, $7::date, true
     )
     returning
       id,
       shop_id,
       technician_user_id,
       base_salary,
       scheduled_commission_rate,
       designated_commission_rate,
       designated_bonus_amount,
       effective_from,
       effective_to,
       is_active`,
    [
      shopId,
      req.params.technicianUserId,
      baseSalary,
      scheduledCommissionRate,
      designatedCommissionRate,
      designatedBonusAmount,
      effectiveFrom || new Date().toISOString().slice(0, 10)
    ]
  );

  return ok(res, {
    overrideRule: mapMoneyFields(result.rows[0], ["base_salary", "designated_bonus_amount"])
  });
});

router.get("/merchant/payroll/summaries", requireShopContext, async (req, res) => {
  const { shopId } = req.ctx;
  const { monthStart, monthLabel } = resolveMonthRange(req.query.month);
  const result = await query(
    `select
       ps.id,
       pc.id as payroll_cycle_id,
       pc.cycle_month,
       tp.user_id as technician_user_id,
       tp.name,
       tp.avatar_url,
       ps.completed_order_count,
       ps.base_salary_amount,
       ps.scheduled_commission_amount,
       ps.designated_commission_amount,
       ps.designated_bonus_total,
       ps.gross_salary_amount,
       ps.payment_status,
       ps.paid_at
     from payroll_cycles pc
     join payroll_summaries ps on ps.payroll_cycle_id = pc.id
     join technician_profiles tp on tp.user_id = ps.technician_user_id
     where pc.shop_id = $1
       and pc.cycle_month = $2::date
     order by ps.gross_salary_amount desc, tp.name asc`,
    [shopId, monthStart.toISOString().slice(0, 10)]
  );

  return ok(res, {
    month: monthLabel,
    summaries: result.rows.map((row) => mapMoneyFields(row, [
      "base_salary_amount",
      "scheduled_commission_amount",
      "designated_commission_amount",
      "designated_bonus_total",
      "gross_salary_amount"
    ]))
  });
});

router.post("/merchant/payroll/cycles/:cycleId/recalculate", requireShopContext, requireUserContext, async (req, res) => {
  const { shopId } = req.ctx;
  const client = await pool.connect();

  try {
    await client.query("begin");

    const cycleResult = await client.query(
      `select id, shop_id, cycle_month, status
       from payroll_cycles
       where id = $1
         and shop_id = $2
       limit 1`,
      [req.params.cycleId, shopId]
    );

    const cycle = cycleResult.rows[0];
    if (!cycle) {
      await client.query("rollback");
      return fail(res, "Payroll cycle not found", 404);
    }

    const monthStart = new Date(cycle.cycle_month);
    const monthEnd = new Date(Date.UTC(monthStart.getUTCFullYear(), monthStart.getUTCMonth() + 1, 1));
    const cycleDate = monthStart.toISOString().slice(0, 10);

    const [techniciansResult, defaultRuleResult, overrideRulesResult, ordersResult] = await Promise.all([
      client.query(
        `select user_id as technician_user_id
         from shop_staff_memberships
         where shop_id = $1
           and role_in_shop = 'technician'
           and membership_status = 'active'`,
        [shopId]
      ),
      client.query(
        `select *
         from payroll_rules
         where shop_id = $1
           and scope_type = 'shop_default'
           and is_active = true
           and effective_from <= $2::date
           and (effective_to is null or effective_to >= $2::date)
         order by effective_from desc
         limit 1`,
        [shopId, cycleDate]
      ),
      client.query(
        `select *
         from payroll_rules
         where shop_id = $1
           and scope_type = 'technician_override'
           and is_active = true
           and effective_from <= $2::date
           and (effective_to is null or effective_to >= $2::date)
         order by effective_from desc`,
        [shopId, cycleDate]
      ),
      client.query(
        `select
           id,
           technician_user_id,
           order_type,
           service_amount
         from orders
         where shop_id = $1
           and status = 'completed'
           and start_time >= $2
           and start_time < $3
         order by start_time asc`,
        [shopId, monthStart, monthEnd]
      )
    ]);

    const defaultRule = normalizeRule(defaultRuleResult.rows[0]);
    if (!defaultRule) {
      await client.query("rollback");
      return fail(res, "No active default payroll rule found for this cycle", 400);
    }

    const overrideRuleMap = new Map(
      overrideRulesResult.rows.map((row) => [row.technician_user_id, normalizeRule(row)])
    );
    const ordersByTechnician = new Map();

    for (const order of ordersResult.rows) {
      if (!ordersByTechnician.has(order.technician_user_id)) {
        ordersByTechnician.set(order.technician_user_id, []);
      }

      ordersByTechnician.get(order.technician_user_id).push(order);
    }

    await client.query(
      `delete from payroll_summaries
       where payroll_cycle_id = $1`,
      [cycle.id]
    );

    for (const technician of techniciansResult.rows) {
      const technicianUserId = technician.technician_user_id;
      const rule = overrideRuleMap.get(technicianUserId) || defaultRule;
      const orders = ordersByTechnician.get(technicianUserId) || [];
      const summary = calculateSummary(rule, orders);

      const summaryResult = await client.query(
        `insert into payroll_summaries (
           payroll_cycle_id,
           shop_id,
           technician_user_id,
           rule_snapshot,
           completed_order_count,
           scheduled_amount_total,
           designated_amount_total,
           scheduled_commission_amount,
           designated_commission_amount,
           designated_bonus_total,
           base_salary_amount,
           gross_salary_amount,
           payment_status
         ) values (
           $1, $2, $3, $4::jsonb, $5, $6, $7, $8, $9, $10, $11, $12, 'pending'
         )
         returning id`,
        [
          cycle.id,
          shopId,
          technicianUserId,
          JSON.stringify(summary.ruleSnapshot),
          summary.completedOrderCount,
          summary.scheduledAmountTotal,
          summary.designatedAmountTotal,
          summary.scheduledCommissionAmount,
          summary.designatedCommissionAmount,
          summary.designatedBonusTotal,
          summary.baseSalaryAmount,
          summary.grossSalaryAmount
        ]
      );

      const payrollSummaryId = summaryResult.rows[0].id;

      for (const order of orders) {
        const commissionRate = order.order_type === "designated"
          ? summary.ruleSnapshot.designated_commission_rate
          : summary.ruleSnapshot.scheduled_commission_rate;
        const designatedBonusAmount = order.order_type === "designated"
          ? summary.ruleSnapshot.designated_bonus_amount
          : 0;

        await client.query(
          `insert into payroll_order_items (
             payroll_summary_id,
             order_id,
             order_type,
             service_amount,
             commission_rate,
             commission_amount,
             designated_bonus_amount,
             included_in_salary
           ) values (
             $1, $2, $3, $4, $5, $6, $7, true
           )`,
          [
            payrollSummaryId,
            order.id,
            order.order_type,
            order.service_amount,
            commissionRate,
            Math.round(Number(order.service_amount || 0) * commissionRate),
            designatedBonusAmount
          ]
        );
      }
    }

    await client.query(
      `update payroll_cycles
       set
         status = 'reviewing',
         updated_at = now()
       where id = $1`,
      [cycle.id]
    );

    await client.query("commit");

    const refreshedSummaries = await query(
      `select
         ps.id,
         tp.name,
         tp.avatar_url,
         ps.completed_order_count,
         ps.base_salary_amount,
         ps.scheduled_commission_amount,
         ps.designated_commission_amount,
         ps.designated_bonus_total,
         ps.gross_salary_amount,
         ps.payment_status
       from payroll_summaries ps
       join technician_profiles tp on tp.user_id = ps.technician_user_id
       where ps.payroll_cycle_id = $1
       order by ps.gross_salary_amount desc, tp.name asc`,
      [cycle.id]
    );

    return ok(res, {
      cycleId: cycle.id,
      month: cycleDate.slice(0, 7),
      summaries: refreshedSummaries.rows.map((row) => mapMoneyFields(row, [
        "base_salary_amount",
        "scheduled_commission_amount",
        "designated_commission_amount",
        "designated_bonus_total",
        "gross_salary_amount"
      ]))
    });
  } catch (error) {
    await client.query("rollback");
    throw error;
  } finally {
    client.release();
  }
});

router.post("/merchant/payroll/summaries/:summaryId/mark-paid", requireShopContext, requireUserContext, async (req, res) => {
  const { shopId, userId } = req.ctx;
  const result = await query(
    `update payroll_summaries
     set
       payment_status = 'paid',
       paid_at = now(),
       paid_by = $3,
       updated_at = now()
     where id = $1
       and shop_id = $2
     returning
       id,
       technician_user_id,
       gross_salary_amount,
       payment_status,
       paid_at,
       paid_by`,
    [req.params.summaryId, shopId, userId]
  );

  if (!result.rows[0]) {
    return fail(res, "Payroll summary not found", 404);
  }

  return ok(res, {
    summary: mapMoneyFields(result.rows[0], ["gross_salary_amount"])
  });
});

router.get("/merchant/payroll/summaries/:summaryId/items", requireShopContext, async (req, res) => {
  const result = await query(
    `select
       poi.id,
       poi.order_id,
       o.order_no,
       poi.order_type,
       o.customer_name,
       o.room_code,
       o.start_time,
       o.end_time,
       poi.service_amount,
       poi.commission_rate,
       poi.commission_amount,
       poi.designated_bonus_amount,
       poi.included_in_salary
     from payroll_order_items poi
     join orders o on o.id = poi.order_id
     where poi.payroll_summary_id = $1
     order by o.start_time asc`,
    [req.params.summaryId]
  );

  return ok(res, {
    summaryId: req.params.summaryId,
    items: result.rows.map((row) => mapMoneyFields(row, [
      "service_amount",
      "commission_amount",
      "designated_bonus_amount"
    ]))
  });
});

module.exports = router;
