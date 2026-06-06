const express = require("express");
const { ok, fail } = require("../lib/respond");
const { pool, query } = require("../lib/db");
const { requireAuth } = require("../middleware/auth");
const { requireMerchantShopAccess } = require("../middleware/authorization");
const { requireShopContext, requireUserContext } = require("../lib/request-context");
const { mapMoneyFields, toCurrency } = require("../lib/formatters");
const { resolveMonthRange } = require("../lib/date-range");
const { wrap } = require("../lib/async-handler");
const { normalizeRule, calculateSummary, ensureCycle, incrementPayroll, closeCycle: closePayrollCycle } = require("../lib/payroll-service");

const router = express.Router();

router.use("/merchant", requireAuth, requireMerchantShopAccess);

router.get("/merchant/payroll/overview", requireShopContext, wrap(async (req, res) => {
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
      count(ps.id) filter (where ps.payment_status = 'pending')::int as pending_count,
      coalesce(sum(ps.gross_salary_amount) filter (where ps.payment_status = 'paid'), 0)::int as paid_amount,
      coalesce(sum(ps.gross_salary_amount) filter (where ps.payment_status = 'pending'), 0)::int as pending_amount
    from cycle c
    left join payroll_summaries ps on ps.payroll_cycle_id = c.id`,
    [shopId, monthStart.toISOString().slice(0, 10)]
  );

  return ok(res, {
    month: monthLabel,
    overview: mapMoneyFields(result.rows[0] || {}, ["total_salary_amount", "average_salary_amount", "paid_amount", "pending_amount"])
  });
}));

router.get("/merchant/payroll/rules", requireShopContext, wrap(async (req, res) => {
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
}));

router.put("/merchant/payroll/rules/default", requireShopContext, wrap(async (req, res) => {
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

  const effectiveFromDate = effectiveFrom || new Date().toISOString().slice(0, 10);

  const baseSalaryCents = Math.round(Number(baseSalary || 0));
  const designatedBonusCents = Math.round(Number(designatedBonusAmount || 0));

  await query(
    `update payroll_rules
     set
       is_active = false,
       effective_to = coalesce(effective_to, $2::date - interval '1 day'),
       updated_at = now()
     where shop_id = $1
       and scope_type = 'shop_default'
       and is_active = true`,
    [shopId, effectiveFromDate]
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
      baseSalaryCents,
      scheduledCommissionRate,
      designatedCommissionRate,
      designatedBonusCents,
      effectiveFromDate
    ]
  );

  return ok(res, {
    defaultRule: mapMoneyFields(result.rows[0], ["base_salary", "designated_bonus_amount"])
  });
}));

router.put("/merchant/payroll/rules/technicians/:technicianUserId", requireShopContext, wrap(async (req, res) => {
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

  const effectiveFromDate = effectiveFrom || new Date().toISOString().slice(0, 10);

  const baseSalaryCents = Math.round(Number(baseSalary || 0));
  const designatedBonusCents = Math.round(Number(designatedBonusAmount || 0));

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
    [shopId, req.params.technicianUserId, effectiveFromDate]
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
      baseSalaryCents,
      scheduledCommissionRate,
      designatedCommissionRate,
      designatedBonusCents,
      effectiveFromDate
    ]
  );

  return ok(res, {
    overrideRule: mapMoneyFields(result.rows[0], ["base_salary", "designated_bonus_amount"])
  });
}));

router.delete("/merchant/payroll/rules/technicians/:technicianUserId", requireShopContext, wrap(async (req, res) => {
  const { shopId } = req.ctx;
  const effectiveToDate = new Date().toISOString().slice(0, 10);

  const result = await query(
    `update payroll_rules
     set
       is_active = false,
       effective_to = $3::date - interval '1 day',
       updated_at = now()
     where shop_id = $1
       and technician_user_id = $2
       and scope_type = 'technician_override'
       and is_active = true
     returning id, technician_user_id`,
    [shopId, req.params.technicianUserId, effectiveToDate]
  );

  if (result.rowCount === 0) {
    return fail(res, "Rule not found or already inactive", 404);
  }

  return ok(res, { deleted: true });
}));

router.post("/merchant/payroll/cycles", requireShopContext, requireUserContext, wrap(async (req, res) => {
  const { shopId, userId } = req.ctx;
  const { cycleMonth } = req.body || {};

  let monthDate;
  if (cycleMonth) {
    monthDate = new Date(`${cycleMonth}-01T00:00:00.000Z`);
    if (Number.isNaN(monthDate.getTime())) {
      return fail(res, "Invalid cycleMonth format, expected YYYY-MM", 400);
    }
  } else {
    const now = new Date();
    monthDate = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
  }

  const client = await pool.connect();
  try {
    await client.query("begin");

    const cycle = await ensureCycle(client, shopId, monthDate, userId);

    await client.query("commit");

    return ok(res, { cycle });
  } catch (error) {
    await client.query("rollback");
    throw error;
  } finally {
    client.release();
  }
}));

router.get("/merchant/payroll/cycles", requireShopContext, wrap(async (req, res) => {
  const { shopId } = req.ctx;
  const page = Math.max(1, Number(req.query.page) || 1);
  const limit = Math.max(1, Math.min(100, Number(req.query.limit) || 12));
  const offset = (page - 1) * limit;

  const countResult = await query(
    `select count(*)::int as total
     from payroll_cycles
     where shop_id = $1`,
    [shopId]
  );

  const total = countResult.rows[0]?.total || 0;

  const result = await query(
    `select
       id,
       cycle_month,
       status,
       started_at,
       closed_at,
       paid_at,
       created_at
     from payroll_cycles
     where shop_id = $1
     order by cycle_month desc
     limit $2 offset $3`,
    [shopId, limit, offset]
  );

  return ok(res, {
    cycles: result.rows,
    pagination: {
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit)
    }
  });
}));

router.get("/merchant/payroll/summaries", requireShopContext, wrap(async (req, res) => {
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
}));

router.post("/merchant/payroll/cycles/:cycleId/close", requireShopContext, requireUserContext, wrap(async (req, res) => {
  const { shopId } = req.ctx;
  const cycle = await closePayrollCycle(shopId, req.params.cycleId);

  if (!cycle) {
    return fail(res, "Payroll cycle not found or cannot be closed (must be in 'reviewing' status)", 404);
  }

  return ok(res, { cycle });
}));

router.post("/merchant/payroll/cycles/:cycleId/recalculate", requireShopContext, requireUserContext, wrap(async (req, res) => {
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
}));

router.post("/merchant/payroll/summaries/:summaryId/mark-paid", requireShopContext, requireUserContext, wrap(async (req, res) => {
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
}));

router.get("/merchant/payroll/summaries/:summaryId/items", requireShopContext, wrap(async (req, res) => {
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
}));

router.get("/merchant/payroll/real-time", requireShopContext, wrap(async (req, res) => {
  const { shopId } = req.ctx;
  const { monthStart, monthEnd } = require("../lib/date-range").resolveMonthRange();

  // 获取所有活跃技师
  const techniciansResult = await query(
    `select
       sm.user_id as technician_user_id,
       tp.name,
       tp.avatar_url,
       tp.employee_no
     from shop_staff_memberships sm
     join technician_profiles tp on tp.user_id = sm.user_id
     where sm.shop_id = $1
       and sm.role_in_shop = 'technician'
       and sm.membership_status = 'active'
     order by tp.created_at asc`,
    [shopId]
  );

  const technicians = techniciansResult.rows;
  
  // 获取当月已完成的订单，关联提成数据
  const ordersResult = await query(
    `select
       o.technician_user_id,
       o.id as order_id,
       o.order_no,
       o.order_type,
       o.start_time,
       o.service_amount,
       si.name as service_name,
       poi.commission_rate,
       poi.commission_amount,
       poi.designated_bonus_amount
     from orders o
     left join service_items si on si.id = o.service_item_id
     left join payroll_order_items poi on poi.order_id = o.id
     where o.shop_id = $1
       and o.status = 'completed'
       and o.start_time >= $2
       and o.start_time < $3
     order by o.start_time desc`,
    [shopId, monthStart, monthEnd]
  );

  // 获取当月的工资规则
  const currentDate = new Date().toISOString().slice(0, 10);
  const rulesResult = await query(
    `select
       pr.technician_user_id,
       pr.scope_type,
       pr.base_salary,
       pr.scheduled_commission_rate,
       pr.designated_commission_rate,
       pr.designated_bonus_amount
     from payroll_rules pr
     where pr.shop_id = $1
       and pr.is_active = true
       and pr.effective_from <= $2::date
       and (pr.effective_to is null or pr.effective_to >= $2::date)`,
    [shopId, currentDate]
  );

  const rulesByTechnician = {};
  const defaultRule = {
    base_salary: 0,
    scheduled_commission_rate: 0,
    designated_commission_rate: 0,
    designated_bonus_amount: 0
  };
  
  rulesResult.rows.forEach(rule => {
    if (rule.scope_type === 'shop_default') {
      Object.assign(defaultRule, {
        base_salary: Number(rule.base_salary || 0),
        scheduled_commission_rate: Number(rule.scheduled_commission_rate || 0),
        designated_commission_rate: Number(rule.designated_commission_rate || 0),
        designated_bonus_amount: Number(rule.designated_bonus_amount || 0)
      });
    } else if (rule.technician_user_id) {
      rulesByTechnician[rule.technician_user_id] = {
        base_salary: Number(rule.base_salary || 0),
        scheduled_commission_rate: Number(rule.scheduled_commission_rate || 0),
        designated_commission_rate: Number(rule.designated_commission_rate || 0),
        designated_bonus_amount: Number(rule.designated_bonus_amount || 0)
      };
    }
  });

  // 为每个技师计算收入
  const technicianEarnings = technicians.map(tech => {
    const techOrders = ordersResult.rows.filter(o => o.technician_user_id === tech.technician_user_id);
    const rule = rulesByTechnician[tech.technician_user_id] || defaultRule;
    
    let scheduledAmountTotal = 0;
    let designatedAmountTotal = 0;
    let scheduledCommissionAmount = 0;
    let designatedCommissionAmount = 0;
    let designatedBonusTotal = 0;
    
    // 处理每个订单，记录计算后的提成数据
    const processedOrders = techOrders.map(order => {
      let commissionAmount = order.commission_amount;
      let bonusAmount = order.designated_bonus_amount;
      let commissionRate = order.commission_rate;
      
      if (order.commission_amount === null || order.commission_amount === undefined) {
        // 实时计算
        const serviceAmount = Number(order.service_amount || 0);
        if (order.order_type === 'designated') {
          designatedAmountTotal += serviceAmount;
          commissionAmount = Math.round(serviceAmount * rule.designated_commission_rate);
          bonusAmount = rule.designated_bonus_amount;
          commissionRate = rule.designated_commission_rate;
          designatedCommissionAmount += commissionAmount;
          designatedBonusTotal += bonusAmount;
        } else {
          scheduledAmountTotal += serviceAmount;
          commissionAmount = Math.round(serviceAmount * rule.scheduled_commission_rate);
          bonusAmount = 0;
          commissionRate = rule.scheduled_commission_rate;
          scheduledCommissionAmount += commissionAmount;
        }
      } else {
        // 使用已有计算数据
        if (order.order_type === 'designated') {
          designatedAmountTotal += Number(order.service_amount || 0);
          designatedCommissionAmount += Number(order.commission_amount || 0);
          designatedBonusTotal += Number(order.designated_bonus_amount || 0);
        } else {
          scheduledAmountTotal += Number(order.service_amount || 0);
          scheduledCommissionAmount += Number(order.commission_amount || 0);
        }
      }
      
      return {
        ...order,
        commission_amount: commissionAmount,
        designated_bonus_amount: bonusAmount,
        commission_rate: commissionRate
      };
    });
    
    const totalAmount = rule.base_salary + scheduledCommissionAmount + designatedCommissionAmount + designatedBonusTotal;
    
    // 处理技师数据（分->元）
    const techData = mapMoneyFields({
      technician_user_id: tech.technician_user_id,
      name: tech.name,
      avatar_url: tech.avatar_url,
      employee_no: tech.employee_no,
      completed_order_count: techOrders.length,
      base_salary_amount: rule.base_salary,
      scheduled_amount_total: scheduledAmountTotal,
      designated_amount_total: designatedAmountTotal,
      scheduled_commission_amount: scheduledCommissionAmount,
      designated_commission_amount: designatedCommissionAmount,
      designated_bonus_total: designatedBonusTotal,
      gross_salary_amount: totalAmount,
      scheduled_commission_rate: rule.scheduled_commission_rate,
      designated_commission_rate: rule.designated_commission_rate
    }, [
      "base_salary_amount",
      "scheduled_amount_total",
      "designated_amount_total",
      "scheduled_commission_amount",
      "designated_commission_amount",
      "designated_bonus_total",
      "gross_salary_amount"
    ]);
    
    // 处理最近订单（分->元）
    const recentOrders = processedOrders.slice(0, 5).map(order => {
      return mapMoneyFields({
        order_id: order.order_id,
        order_no: order.order_no,
        order_type: order.order_type,
        service_name: order.service_name,
        service_amount: order.service_amount,
        commission_amount: order.commission_amount,
        designated_bonus_amount: order.designated_bonus_amount,
        start_time: order.start_time
      }, [
        "service_amount",
        "commission_amount",
        "designated_bonus_amount"
      ]);
    });
    
    return {
      ...techData,
      recent_orders: recentOrders
    };
  });

  // 计算总体统计（这些是分，需要转换为元）
  const totalGrossCents = technicianEarnings.reduce((sum, t) => {
    // 注意：这里要使用原始的分计算，但是technicianEarnings已经被转成元了
    // 所以我们需要重新计算
    let total = 0;
    const techOrders = ordersResult.rows.filter(o => o.technician_user_id === t.technician_user_id);
    const rule = rulesByTechnician[t.technician_user_id] || defaultRule;
    
    let sComm = 0;
    let dComm = 0;
    let dBonus = 0;
    
    techOrders.forEach(order => {
      if (order.commission_amount !== null && order.commission_amount !== undefined) {
        if (order.order_type === 'designated') {
          dComm += Number(order.commission_amount || 0);
          dBonus += Number(order.designated_bonus_amount || 0);
        } else {
          sComm += Number(order.commission_amount || 0);
        }
      } else {
        const serviceAmount = Number(order.service_amount || 0);
        if (order.order_type === 'designated') {
          const commission = Math.round(serviceAmount * rule.designated_commission_rate);
          dComm += commission;
          dBonus += rule.designated_bonus_amount;
        } else {
          const commission = Math.round(serviceAmount * rule.scheduled_commission_rate);
          sComm += commission;
        }
      }
    });
    total = rule.base_salary + sComm + dComm + dBonus;
    return sum + total;
  }, 0);
  
  const totalOrderCount = technicianEarnings.reduce((sum, t) => sum + t.completed_order_count, 0);

  return ok(res, {
    total_gross: toCurrency(totalGrossCents),
    total_order_count: totalOrderCount,
    technicians: technicianEarnings
  });
}));

module.exports = router;
