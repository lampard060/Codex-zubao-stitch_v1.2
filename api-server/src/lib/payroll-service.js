const { query: dbQuery } = require("./db");

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

async function resolveRule(client, shopId, technicianUserId, cycleDate) {
  const cycleDateStr = cycleDate instanceof Date ? cycleDate.toISOString().slice(0, 10) : cycleDate;

  const overrideResult = await client.query(
    `select *
     from payroll_rules
     where shop_id = $1
       and technician_user_id = $2
       and scope_type = 'technician_override'
       and is_active = true
       and effective_from <= $3::date
       and (effective_to is null or effective_to >= $3::date)
     order by effective_from desc
     limit 1`,
    [shopId, technicianUserId, cycleDateStr]
  );

  if (overrideResult.rows[0]) {
    return normalizeRule(overrideResult.rows[0]);
  }

  const defaultResult = await client.query(
    `select *
     from payroll_rules
     where shop_id = $1
       and scope_type = 'shop_default'
       and is_active = true
       and effective_from <= $2::date
       and (effective_to is null or effective_to >= $2::date)
     order by effective_from desc
     limit 1`,
    [shopId, cycleDateStr]
  );

  return normalizeRule(defaultResult.rows[0]);
}

async function ensureCycle(client, shopId, cycleMonth, userId) {
  const cycleDateStr = cycleMonth instanceof Date
    ? cycleMonth.toISOString().slice(0, 10)
    : cycleMonth;

  const existingResult = await client.query(
    `select id, cycle_month, status, started_at
     from payroll_cycles
     where shop_id = $1
       and cycle_month = $2::date
     limit 1`,
    [shopId, cycleDateStr]
  );

  if (existingResult.rows[0]) {
    return existingResult.rows[0];
  }

  const newCycleResult = await client.query(
    `insert into payroll_cycles (shop_id, cycle_month, status, created_by)
     values ($1, $2::date, 'draft', $3)
     returning id, cycle_month, status, started_at`,
    [shopId, cycleDateStr, userId]
  );

  return newCycleResult.rows[0];
}

async function incrementPayroll(client, shopId, technicianUserId, order, cycle) {
  const orderDate = order.start_time || order.created_at;
  const ruleDateStr = orderDate instanceof Date
    ? orderDate.toISOString().slice(0, 10)
    : String(orderDate).slice(0, 10);

  const rule = await resolveRule(client, shopId, technicianUserId, ruleDateStr);
  if (!rule) {
    return null;
  }

  const serviceAmount = Number(order.service_amount || 0);
  const isDesignated = order.order_type === "designated";
  const commissionRate = isDesignated ? rule.designated_commission_rate : rule.scheduled_commission_rate;
  const commissionAmount = Math.round(serviceAmount * commissionRate);
  const designatedBonusAmount = isDesignated ? rule.designated_bonus_amount : 0;

  const summaryResult = await client.query(
    `select id, completed_order_count, scheduled_amount_total, designated_amount_total,
            scheduled_commission_amount, designated_commission_amount, designated_bonus_total,
            base_salary_amount, gross_salary_amount
     from payroll_summaries
     where payroll_cycle_id = $1
       and technician_user_id = $2
     limit 1`,
    [cycle.id, technicianUserId]
  );

  if (summaryResult.rows[0]) {
    const summary = summaryResult.rows[0];
    const newCompletedOrderCount = summary.completed_order_count + 1;
    const newScheduledAmountTotal = isDesignated
      ? summary.scheduled_amount_total
      : summary.scheduled_amount_total + serviceAmount;
    const newDesignatedAmountTotal = isDesignated
      ? summary.designated_amount_total + serviceAmount
      : summary.designated_amount_total;
    const newScheduledCommissionAmount = isDesignated
      ? summary.scheduled_commission_amount
      : summary.scheduled_commission_amount + commissionAmount;
    const newDesignatedCommissionAmount = isDesignated
      ? summary.designated_commission_amount + commissionAmount
      : summary.designated_commission_amount;
    const newDesignatedBonusTotal = summary.designated_bonus_total + designatedBonusAmount;
    const newGrossSalaryAmount = summary.base_salary_amount + newScheduledCommissionAmount + newDesignatedCommissionAmount + newDesignatedBonusTotal;

    await client.query(
      `update payroll_summaries set
         completed_order_count = $3,
         scheduled_amount_total = $4,
         designated_amount_total = $5,
         scheduled_commission_amount = $6,
         designated_commission_amount = $7,
         designated_bonus_total = $8,
         gross_salary_amount = $9,
         updated_at = now()
       where id = $1 and payroll_cycle_id = $2`,
      [summary.id, cycle.id, newCompletedOrderCount, newScheduledAmountTotal, newDesignatedAmountTotal,
       newScheduledCommissionAmount, newDesignatedCommissionAmount, newDesignatedBonusTotal, newGrossSalaryAmount]
    );

    await client.query(
      `insert into payroll_order_items (
         payroll_summary_id, order_id, order_type, service_amount,
         commission_rate, commission_amount, designated_bonus_amount, included_in_salary
       ) values ($1, $2, $3, $4, $5, $6, $7, true)
       on conflict (payroll_summary_id, order_id) do nothing`,
      [summary.id, order.id, order.order_type, serviceAmount, commissionRate, commissionAmount, designatedBonusAmount]
    );

    return { summaryId: summary.id, updated: true };
  } else {
    const scheduledAmountTotal = isDesignated ? 0 : serviceAmount;
    const designatedAmountTotal = isDesignated ? serviceAmount : 0;
    const scheduledCommissionAmount = isDesignated ? 0 : commissionAmount;
    const designatedCommissionAmount = isDesignated ? commissionAmount : 0;
    const grossSalaryAmount = rule.base_salary + scheduledCommissionAmount + designatedCommissionAmount + designatedBonusAmount;

    const newSummaryResult = await client.query(
      `insert into payroll_summaries (
         payroll_cycle_id, shop_id, technician_user_id, rule_snapshot,
         completed_order_count, scheduled_amount_total, designated_amount_total,
         scheduled_commission_amount, designated_commission_amount, designated_bonus_total,
         base_salary_amount, gross_salary_amount, payment_status
       ) values ($1, $2, $3, $4::jsonb, $5, $6, $7, $8, $9, $10, $11, $12, 'pending')
       returning id`,
      [cycle.id, shopId, technicianUserId, JSON.stringify(rule), 1, scheduledAmountTotal, designatedAmountTotal,
       scheduledCommissionAmount, designatedCommissionAmount, designatedBonusAmount,
       rule.base_salary, grossSalaryAmount]
    );

    const newSummaryId = newSummaryResult.rows[0].id;

    await client.query(
      `insert into payroll_order_items (
         payroll_summary_id, order_id, order_type, service_amount,
         commission_rate, commission_amount, designated_bonus_amount, included_in_salary
       ) values ($1, $2, $3, $4, $5, $6, $7, true)`,
      [newSummaryId, order.id, order.order_type, serviceAmount, commissionRate, commissionAmount, designatedBonusAmount]
    );

    return { summaryId: newSummaryId, updated: false };
  }
}

async function closeCycle(shopId, cycleId) {
  const result = await dbQuery(
    `update payroll_cycles
     set
       status = 'paid',
       closed_at = now(),
       paid_at = now(),
       updated_at = now()
     where id = $1
       and shop_id = $2
       and status = 'reviewing'
     returning id, cycle_month, status, closed_at, paid_at`,
    [cycleId, shopId]
  );

  return result.rows[0] || null;
}

module.exports = {
  normalizeRule,
  calculateSummary,
  resolveRule,
  ensureCycle,
  incrementPayroll,
  closeCycle
};
