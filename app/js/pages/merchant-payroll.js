import { getSession, setSession, clearSession, getHomePathByRole, ensureMerchantSession, ensureTechnicianSession, DEFAULT_SHOP_ID } from "../utils/session.js";
import { apiRequest } from "../utils/api.js";
import { formatCurrency, formatAmountInputValue, parseAmountInputValue, normalizeAmountInputElement, bindAmountInputNormalization, formatMonth, formatDateTime, toDateTimeLocalValue, getInitial } from "../utils/format.js";
import { showFieldFeedback, downloadTextFile, renderFallback } from "../utils/dom.js";

function getCurrentMonth() {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
}

function showMonthPickerModal(session, headers) {
  const existingModal = document.querySelector(".payroll-month-modal");
  if (existingModal) {
    existingModal.remove();
  }

  const modal = document.createElement("div");
  modal.className = "payroll-month-modal";
  modal.innerHTML = `
    <div class="payroll-month-modal-overlay"></div>
    <div class="payroll-month-modal-content">
      <h3 style="margin: 0 0 16px; font-size: 1.25rem;">选择工资周期</h3>
      <p class="small" style="color: var(--on-surface-variant); margin-bottom: 16px;">
        选择要生成工资单的月份。系统将自动计算当月所有已完成订单的工资。
      </p>
      <input type="month" id="payroll-cycle-picker" value="${getCurrentMonth()}"
        min="2020-01" max="${getCurrentMonth()}"
        style="width: 100%; padding: 12px; border: 1px solid var(--outline); border-radius: 8px; font-size: 1rem;">
      <div style="display: flex; gap: 12px; margin-top: 20px; justify-content: flex-end;">
        <button class="ghost-button" id="payroll-cycle-cancel">取消</button>
        <button class="pill-button" id="payroll-cycle-confirm">确定生成</button>
      </div>
    </div>
  `;

  document.body.appendChild(modal);

  const style = document.createElement("style");
  style.textContent = `
    .payroll-month-modal {
      position: fixed;
      inset: 0;
      z-index: 1000;
      display: flex;
      align-items: center;
      justify-content: center;
    }
    .payroll-month-modal-overlay {
      position: absolute;
      inset: 0;
      background: rgba(0, 0, 0, 0.4);
    }
    .payroll-month-modal-content {
      position: relative;
      background: white;
      padding: 24px;
      border-radius: 16px;
      max-width: 400px;
      width: 90%;
      box-shadow: 0 8px 32px rgba(0, 0, 0, 0.2);
    }
  `;
  document.head.appendChild(style);

  modal.querySelector(".payroll-month-modal-overlay").addEventListener("click", () => modal.remove());
  modal.querySelector("#payroll-cycle-cancel").addEventListener("click", () => modal.remove());

  modal.querySelector("#payroll-cycle-confirm").addEventListener("click", async () => {
    const monthInput = modal.querySelector("#payroll-cycle-picker");
    const cycleMonth = monthInput.value;

    if (!cycleMonth) {
      return;
    }

    const confirmBtn = modal.querySelector("#payroll-cycle-confirm");
    const cancelBtn = modal.querySelector("#payroll-cycle-cancel");
    confirmBtn.disabled = true;
    cancelBtn.disabled = true;
    confirmBtn.textContent = "生成中...";

    try {
      showFieldFeedback("payroll-rule-feedback", `正在生成 ${cycleMonth} 工资单...`);

      const cycleData = await apiRequest(`/merchant/payroll/cycles?shopId=${session.shopId}`, { headers });
      const existingCycle = cycleData.cycles?.find(c => {
        const cycleMonthStr = new Date(c.cycle_month).toISOString().slice(0, 7);
        return cycleMonthStr === cycleMonth;
      });

      if (existingCycle) {
        await apiRequest(`/merchant/payroll/cycles/${existingCycle.id}/recalculate?shopId=${session.shopId}`, {
          method: "POST",
          headers
        });
      } else {
        await apiRequest(`/merchant/payroll/cycles?shopId=${session.shopId}`, {
          method: "POST",
          headers,
          body: { cycleMonth }
        });
        const newCyclesData = await apiRequest(`/merchant/payroll/cycles?shopId=${session.shopId}`, { headers });
        const newCycle = newCyclesData.cycles?.find(c => {
          const cycleMonthStr = new Date(c.cycle_month).toISOString().slice(0, 7);
          return cycleMonthStr === cycleMonth;
        });
        if (newCycle) {
          await apiRequest(`/merchant/payroll/cycles/${newCycle.id}/recalculate?shopId=${session.shopId}`, {
            method: "POST",
            headers
          });
        }
      }

      modal.remove();
      location.reload();
    } catch (error) {
      showFieldFeedback("payroll-rule-feedback", error.message, true);
      confirmBtn.disabled = false;
      cancelBtn.disabled = false;
      confirmBtn.textContent = "确定生成";
    }
  });
}

export async function initMerchantPayroll() {
  const session = ensureMerchantSession();
  const headers = {
    "x-shop-id": session.shopId,
    "x-user-id": session.user.id
  };

  document.querySelector(".primary-cta")?.addEventListener("click", () => {
    showMonthPickerModal(session, headers);
  });

  const [overviewData, summaryData, rulesData] = await Promise.all([
    apiRequest(`/merchant/payroll/overview?shopId=${session.shopId}`, { headers }),
    apiRequest(`/merchant/payroll/summaries?shopId=${session.shopId}`, { headers }),
    apiRequest(`/merchant/payroll/rules?shopId=${session.shopId}`, { headers })
  ]);

  const monthLabel = formatMonth(overviewData.month);
  document.getElementById("payroll-cycle-month-sidebar").textContent = monthLabel;
  document.getElementById("payroll-cycle-month-toolbar").textContent = monthLabel.replace(/\s/g, "");
  document.getElementById("payroll-total-amount").textContent = formatCurrency(overviewData.overview?.total_salary_amount || 0);
  document.getElementById("payroll-technician-count").textContent = `${overviewData.overview?.technician_count || 0} 人`;
  document.getElementById("payroll-average-amount").textContent = formatCurrency(overviewData.overview?.average_salary_amount || 0);
  document.getElementById("payroll-status-summary").textContent = `${overviewData.overview?.paid_count || 0} / ${overviewData.overview?.pending_count || 0}`;

  const summaryList = document.getElementById("payroll-summary-list");
  const summaries = summaryData.summaries || [];
  const detailPanel = document.getElementById("payroll-detail-panel");
  const detailTitle = document.getElementById("payroll-detail-title");
  const detailItems = document.getElementById("payroll-detail-items");
  summaryList.innerHTML = summaries.map((summary) => `
    <article class="payroll-row ${summary.payment_status === "pending" ? "pending" : ""}">
      <div class="payroll-tech">
        <div class="portrait payroll-portrait"><div class="portrait-fallback">${getInitial(summary.name)}</div></div>
        <div>
          <div class="payroll-tech-name">${summary.name}</div>
          <div class="small">${summary.technician_user_id.slice(0, 8)}</div>
        </div>
      </div>
      <div class="payroll-rule">
        <strong>排钟提成 ${formatCurrency(summary.scheduled_commission_amount)}</strong>
        <div class="small">点钟提成 ${formatCurrency(summary.designated_commission_amount)}</div>
      </div>
      <div class="payroll-orders">
        <strong>${summary.completed_order_count} 单</strong>
        <div class="small">底薪 ${formatCurrency(summary.base_salary_amount)}</div>
      </div>
      <div class="payroll-amount">${formatCurrency(summary.gross_salary_amount)}</div>
      <div><span class="badge ${summary.payment_status === "paid" ? "success" : "warning"}">${summary.payment_status === "paid" ? "已发放" : "未发放"}</span></div>
      <div class="payroll-actions">
        <button class="icon-button" data-payroll-view="${summary.id}" data-payroll-name="${summary.name}"><span class="material-symbols-outlined">visibility</span></button>
        ${summary.payment_status === "pending" ? `<button class="pill-button small-pill" data-payroll-paid="${summary.id}">标记发放</button>` : `<button class="icon-button"><span class="material-symbols-outlined">check</span></button>`}
      </div>
    </article>
  `).join("");

  summaryList.querySelectorAll("[data-payroll-view]").forEach((button) => {
    button.addEventListener("click", async () => {
      try {
        const data = await apiRequest(`/merchant/payroll/summaries/${button.dataset.payrollView}/items?shopId=${session.shopId}`, { headers });
        if (detailTitle) {
          detailTitle.textContent = `${button.dataset.payrollName}本月订单计薪明细`;
        }
        if (detailItems) {
          if (!data.items?.length) {
            renderFallback(detailItems, "当前工资记录下没有订单明细。");
          } else {
            detailItems.innerHTML = data.items.map((item) => `
              <div class="record-row" style="grid-template-columns: minmax(0, 1fr) auto">
                <div>
                  <div style="font-weight: 800">${item.order_no} · ${item.order_type === "designated" ? "点钟" : "排钟"}</div>
                  <div class="small">客户：${item.customer_name || "到店客户"} · 房号：${item.room_code || "--"} · ${formatDateTime(item.start_time)}</div>
                  <div class="small">服务金额 ${formatCurrency(item.service_amount)} · 提成 ${formatCurrency(item.commission_amount)} · 点钟费 ${formatCurrency(item.designated_bonus_amount || 0)}</div>
                </div>
                <span class="badge ${item.included_in_salary ? "success" : "neutral"}">${item.included_in_salary ? "已计入工资" : "未计入"}</span>
              </div>
            `).join("");
          }
        }
        if (detailPanel) {
          detailPanel.hidden = false;
          detailPanel.scrollIntoView({ behavior: "smooth", block: "start" });
        }
      } catch (error) {
        showFieldFeedback("payroll-rule-feedback", error.message, true);
      }
    });
  });

  document.getElementById("payroll-detail-close")?.addEventListener("click", () => {
    if (detailPanel) detailPanel.hidden = true;
  });

  summaryList.querySelectorAll("[data-payroll-paid]").forEach((button) => {
    button.addEventListener("click", async () => {
      try {
        await apiRequest(`/merchant/payroll/summaries/${button.dataset.payrollPaid}/mark-paid?shopId=${session.shopId}`, {
          method: "POST",
          headers
        });
        location.reload();
      } catch (error) {
        showFieldFeedback("payroll-rule-feedback", error.message, true);
      }
    });
  });

  const defaultRuleList = document.getElementById("payroll-default-rule-list");
  const rule = rulesData.defaultRule || {};
  const baseSalaryInput = document.getElementById("payroll-rule-base-salary");
  const designatedBonusInput = document.getElementById("payroll-rule-designated-bonus");
  const scheduledRateInput = document.getElementById("payroll-rule-scheduled-rate");
  const designatedRateInput = document.getElementById("payroll-rule-designated-rate");
  if (baseSalaryInput) baseSalaryInput.value = formatAmountInputValue(rule.base_salary || 0);
  if (designatedBonusInput) designatedBonusInput.value = formatAmountInputValue(rule.designated_bonus_amount || 0);
  if (scheduledRateInput) scheduledRateInput.value = String(Number(rule.scheduled_commission_rate || 0) * 100);
  if (designatedRateInput) designatedRateInput.value = String(Number(rule.designated_commission_rate || 0) * 100);
  bindAmountInputNormalization(baseSalaryInput);
  bindAmountInputNormalization(designatedBonusInput);
  defaultRuleList.innerHTML = [
    ["门店默认底薪", "适用于未设置单独规则的技师", formatCurrency(rule.base_salary || 0)],
    ["排钟提成比例", "排钟订单服务金额 × 提成比例", `${Number(rule.scheduled_commission_rate || 0) * 100}%`],
    ["点钟提成比例", "点钟订单服务金额 × 点钟提成比例", `${Number(rule.designated_commission_rate || 0) * 100}%`],
    ["点钟费", "每笔点钟订单固定增加", formatCurrency(rule.designated_bonus_amount || 0)]
  ].map(([title, desc, value]) => `
    <article class="record-row" style="grid-template-columns: 1fr auto">
      <div>
        <div style="font-weight: 800">${title}</div>
        <div class="small">${desc}</div>
      </div>
      <div class="amount">${value}</div>
    </article>
  `).join("");

  document.getElementById("payroll-save-rule-button")?.addEventListener("click", async () => {
    try {
      showFieldFeedback("payroll-rule-feedback", "");
      await apiRequest(`/merchant/payroll/rules/default?shopId=${session.shopId}`, {
        method: "PUT",
        headers,
        body: {
          baseSalary: parseAmountInputValue(baseSalaryInput?.value),
          designatedBonusAmount: parseAmountInputValue(designatedBonusInput?.value),
          scheduledCommissionRate: Number(scheduledRateInput?.value || 0) / 100,
          designatedCommissionRate: Number(designatedRateInput?.value || 0) / 100
        }
      });
      showFieldFeedback("payroll-rule-feedback", "默认规则已保存，可继续重算本月工资。");
      location.reload();
    } catch (error) {
      showFieldFeedback("payroll-rule-feedback", error.message, true);
    }
  });

  document.getElementById("payroll-recalculate-button")?.addEventListener("click", async () => {
    try {
      showFieldFeedback("payroll-rule-feedback", "");
      const cycleId = summaries[0]?.payroll_cycle_id;
      if (!cycleId) {
        throw new Error("当前工资周期不存在，暂时无法重算。请先点击左侧「生成工资单」按钮。");
      }
      await apiRequest(`/merchant/payroll/cycles/${cycleId}/recalculate?shopId=${session.shopId}`, {
        method: "POST",
        headers
      });
      location.reload();
    } catch (error) {
      showFieldFeedback("payroll-rule-feedback", error.message, true);
    }
  });

  document.querySelectorAll("[data-payroll-batch-pay]").forEach((button) => {
    button.addEventListener("click", async () => {
      try {
        showFieldFeedback("payroll-rule-feedback", "");
        const pendingSummaries = summaries.filter((item) => item.payment_status === "pending");
        if (!pendingSummaries.length) {
          throw new Error("当前没有待发放工资。");
        }
        await Promise.all(pendingSummaries.map((item) => apiRequest(
          `/merchant/payroll/summaries/${item.id}/mark-paid?shopId=${session.shopId}`,
          { method: "POST", headers }
        )));
        location.reload();
      } catch (error) {
        showFieldFeedback("payroll-rule-feedback", error.message, true);
      }
    });
  });

  document.querySelectorAll("[data-payroll-export]").forEach((button) => {
    button.addEventListener("click", () => {
      const rows = [
        ["技师姓名", "工号", "完成单数", "底薪", "排钟提成", "点钟提成", "点钟费", "应发工资", "发放状态"],
        ...summaries.map((summary) => [
          summary.name,
          summary.technician_user_id.slice(0, 8),
          summary.completed_order_count,
          Number(summary.base_salary_amount || 0).toFixed(2),
          Number(summary.scheduled_commission_amount || 0).toFixed(2),
          Number(summary.designated_commission_amount || 0).toFixed(2),
          Number(summary.designated_bonus_total || 0).toFixed(2),
          Number(summary.gross_salary_amount || 0).toFixed(2),
          summary.payment_status === "paid" ? "已发放" : "未发放"
        ])
      ];
      const csv = `\uFEFF${rows.map((row) => row.map((cell) => `"${String(cell).replaceAll("\"", "\"\"")}"`).join(",")).join("\n")}`;
      downloadTextFile(`足宝工资表-${overviewData.month || "current"}.csv`, csv, "text/csv;charset=utf-8");
    });
  });
}

export default async function init() {
  await initMerchantPayroll();
}
