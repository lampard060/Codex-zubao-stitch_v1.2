import { getSession, setSession, clearSession, getHomePathByRole, ensureMerchantSession, ensureTechnicianSession, DEFAULT_SHOP_ID } from "../utils/session.js";
import { apiRequest } from "../utils/api.js";
import { formatCurrency, formatAmountInputValue, parseAmountInputValue, normalizeAmountInputElement, bindAmountInputNormalization, formatMonth, formatDateTime, toDateTimeLocalValue, getInitial } from "../utils/format.js";
import { showFieldFeedback, downloadTextFile, renderFallback } from "../utils/dom.js";

export async function initMerchantAnalytics() {
  const session = ensureMerchantSession();
  const headers = {
    "x-shop-id": session.shopId,
    "x-user-id": session.user.id
  };
  const periodLabels = {
    today: "今日",
    month: "本月",
    year: "本年"
  };

  async function renderAnalytics(period = "year") {
    let data;
    try {
      data = await apiRequest(`/merchant/analytics?shopId=${session.shopId}&period=${period}`, { headers });
    } catch (error) {
      renderFallback(document.querySelector(".main-panel") || document.body, `加载统计失败：${error.message}`);
      return;
    }
    document.querySelectorAll("[data-analytics-period]").forEach((button) => {
      button.className = button.dataset.analyticsPeriod === period ? "pill-button" : "ghost-button";
    });
    document.getElementById("analytics-page-copy").textContent = `当前查看${periodLabels[period]}经营表现，统计周期 ${data.periodLabel}。`;
    const analyticsChipFocus = document.getElementById("analytics-chip-focus");
    if (analyticsChipFocus) analyticsChipFocus.textContent = `${periodLabels[period]}统计周期 ${data.periodLabel}`;
    const analyticsHeroBadges = document.getElementById("analytics-period-badges-hero");
    if (analyticsHeroBadges) {
      analyticsHeroBadges.innerHTML = `
        <span class="merchant-page-chip ${period === "today" ? "strong" : ""}">今日</span>
        <span class="merchant-page-chip ${period === "month" ? "strong" : ""}">本月</span>
        <span class="merchant-page-chip ${period === "year" ? "strong" : ""}">本年</span>
        <span class="merchant-page-chip">${data.periodLabel}</span>
      `;
    }
    document.getElementById("analytics-gross-trend-label").textContent = `${periodLabels[period]}累计`;
    document.getElementById("analytics-trend-copy").textContent = `当前按${periodLabels[period]}展示经营变化趋势。`;
    document.getElementById("analytics-period-badges").innerHTML = `
      <span class="badge ${period === "today" ? "success" : "neutral"}">今日</span>
      <span class="badge ${period === "month" ? "success" : "neutral"}">本月</span>
      <span class="badge ${period === "year" ? "success" : "neutral"}">本年</span>
    `;

    document.getElementById("analytics-gross-revenue").textContent = formatCurrency(data.structure?.gross_revenue || 0);
    document.getElementById("analytics-payroll-cost").textContent = formatCurrency(data.structure?.payroll_cost || 0);
    document.getElementById("analytics-net-revenue").textContent = formatCurrency(data.structure?.net_revenue || 0);

    const trend = data.trend || [];
    const maxRevenue = Math.max(...trend.map((entry) => Number(entry.revenue || 0)), 1);
    const activeIndex = trend.reduce((bestIndex, item, index, list) => {
      const current = Number(item.revenue || 0);
      const best = Number(list[bestIndex]?.revenue || 0);
      return current > best ? index : bestIndex;
    }, 0);

    document.getElementById("analytics-weekly-trend").style.gridTemplateColumns = `repeat(${Math.max(trend.length, 1)}, minmax(0, 1fr))`;
    document.getElementById("analytics-weekly-trend").innerHTML = trend.map((item, index) => `
      <div class="dashboard-analytics-col">
        <div class="dashboard-analytics-bar ${index === activeIndex ? "active" : ""}" style="height: ${Math.max(18, Math.round((Number(item.revenue || 0) / maxRevenue) * 100))}%"></div>
        <span>${item.label}</span>
      </div>
    `).join("");

    document.getElementById("analytics-structure-list").innerHTML = [
      ["营业收入", formatCurrency(data.structure?.gross_revenue || 0)],
      ["工资支出", formatCurrency(data.structure?.payroll_cost || 0)],
      ["净营收", formatCurrency(data.structure?.net_revenue || 0)]
    ].map(([label, value]) => `
      <div class="dashboard-status-row">
        <span>${label}</span>
        <strong>${value}</strong>
      </div>
    `).join("");

    document.getElementById("analytics-payroll-summary").innerHTML = (data.payrollSummary || []).map((item) => `
      <div class="analytics-tech-row">
        <div class="analytics-tech-meta">
          <div class="avatar-sm avatar-fallback">${getInitial(item.name)}</div>
          <div>
            <strong>${item.name}</strong>
            <p>底薪 ${formatCurrency(item.base_salary_amount)} + 排钟 ${formatCurrency(item.scheduled_commission_amount)} + 点钟 ${formatCurrency(item.designated_commission_amount)} + 点钟费 ${formatCurrency(item.designated_bonus_total)}</p>
          </div>
        </div>
        <span class="analytics-tech-amount">${formatCurrency(item.gross_salary_amount)}</span>
      </div>
    `).join("");

    document.getElementById("analytics-contribution-list").innerHTML = (data.technicianContributionRanking || []).map((item) => `
      <div class="analytics-tech-row">
        <div class="analytics-tech-meta">
          <div class="avatar-sm avatar-fallback">${getInitial(item.name)}</div>
          <div>
            <strong>${item.name}</strong>
            <p>${item.completed_order_count} 单 · 服务营收</p>
          </div>
        </div>
        <span class="analytics-tech-amount">${formatCurrency(item.service_revenue)}</span>
      </div>
    `).join("");
  }

  document.querySelectorAll("[data-analytics-period]").forEach((button) => {
    button.addEventListener("click", () => {
      renderAnalytics(button.dataset.analyticsPeriod).catch((error) => {
        console.error("[analytics-render-error]", error);
      });
    });
  });

  await renderAnalytics("year");
}

export default async function init() {
  await initMerchantAnalytics();
}
