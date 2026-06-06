import { initIconFallback } from "../utils/icon-fallback.js";
import { initBrandingAssets } from "../utils/branding.js";
import { apiRequest } from "../utils/api.js";
import { ensureTechnicianSession } from "../utils/session.js";
import { registerTechnicianServiceWorker } from "../utils/pwa.js";
import { getTechnicianMembershipStatus, renderBottomNav, renderTopbar, normalizeMoneyUnit } from "../utils/technician-shared.js?v=20260515-redesign";

let currentPeriod = "today";

const PERIOD_META = {
  today: { amountLabel: "服务总额", fallbackTrendText: "暂无昨日对比数据" },
  month: { amountLabel: "服务总额", fallbackTrendText: "暂无上月对比数据" },
  salary: { amountLabel: "平均月工资", fallbackTrendText: "暂无前一月工资对比数据" },
  year: { amountLabel: "服务总额", fallbackTrendText: "暂无去年对比数据" }
};

const MOCK_DATA = {
  today: {
    label: "今日累计收益",
    total: 298,
    orders: 1,
    amount: 398,
    amountLabel: "服务总额",
    trendText: "+12.4% 较昨日",
    chart: [120, 180, 200, 150, 220, 180, 160],
    chartLabels: ["05/09", "05/10", "05/11", "05/12", "05/13", "05/14", "05/15"],
    chartMaxIndex: 4,
    details: [
      { id: "1", order_no: "ZB-8636", order_type: "designated", name: "深度放松按摩", time: "5 月 15 日", duration: "14:30", amount: 119.2, service_amount: 298, icon: "spa" },
      { id: "2", order_no: "ZB-8635", order_type: "scheduled", name: "VIP 面部护理", time: "5 月 14 日", duration: "11:00", amount: 280, service_amount: 680, icon: "face" },
      { id: "3", order_no: "ZB-8634", order_type: "designated", name: "基础拉伸指导", time: "5 月 13 日", duration: "09:15", amount: 120, service_amount: 268, icon: "self_improvement" }
    ]
  },
  month: {
    label: "本月累计收益",
    total: 2450,
    orders: 142,
    amount: 6840,
    amountLabel: "服务总额",
    trendText: "较上月增长 15%",
    chart: [4200, 7200, 6800, 9800, 12500, 11800, 12450, 0, 0, 0, 0, 0],
    chartLabels: ["1 月", "2 月", "3 月", "4 月", "5 月", "6 月", "7 月", "8 月", "9 月", "10 月", "11 月", "12 月"],
    chartMaxIndex: 4,
    details: [
      { id: "4", order_no: "ZB-8633", order_type: "scheduled", name: "7 月 24 日", time: "2 单完成", amount: 370, service_amount: 880, icon: "calendar_today" },
      { id: "5", order_no: "ZB-8632", order_type: "designated", name: "7 月 23 日", time: "1 单完成", amount: 90, service_amount: 200, icon: "calendar_today" }
    ]
  },
  salary: {
    label: "上月工资",
    total: 3500,
    orders: 142,
    amount: 1214.3,
    amountLabel: "平均月工资",
    trendText: "较前一月工资增长 5%",
    chart: [5800, 6200, 6500, 7200, 7800, 8100, 8500, 0, 0, 0, 0, 0],
    chartLabels: ["1 月", "2 月", "3 月", "4 月", "5 月", "6 月", "7 月", "8 月", "9 月", "10 月", "11 月", "12 月"],
    chartMaxIndex: 6,
    details: [
      { id: "6", name: "7 月工资单", time: "已发放", duration: "42 单", amount: 3500, icon: "payments" },
      { id: "7", name: "6 月工资单", time: "已发放", duration: "38 单", amount: 3100, icon: "payments" }
    ]
  },
  year: {
    label: "本年度累计收益",
    total: 13860,
    orders: 486,
    amount: 52000,
    amountLabel: "服务总额",
    trendText: "+18.3% 较去年",
    chart: [52000, 82000, 138600],
    chartLabels: ["2024", "2025", "2026"],
    chartMaxIndex: 2,
    details: [
      { id: "8", name: "2026 年度累计", time: "全年", amount: 138600, icon: "bar_chart" },
      { id: "9", name: "2025 年度累计", time: "全年", amount: 82000, icon: "bar_chart" },
      { id: "10", name: "2024 年度累计", time: "全年", amount: 52000, icon: "bar_chart" }
    ]
  }
};

async function init() {
  initIconFallback();
  initBrandingAssets();
  registerTechnicianServiceWorker();
  renderTopbar({ title: "我的收益", showBack: true });
  renderBottomNav("earnings", true);

  try {
    ensureTechnicianSession();
  } catch (error) {
    console.warn("缺少技师登录状态，已保留收益页静态预览:", error);
    renderEarnings(MOCK_DATA[currentPeriod]);
    bindEvents();
    return;
  }

  let isSigned = false;
  try {
    const membership = await getTechnicianMembershipStatus();
    isSigned = membership.isSigned;
  } catch (error) {
    console.warn("获取签约状态失败:", error);
  }

  if (!isSigned) {
    window.location.href = "./technician-join-shop.html";
    return;
  }

  if (isPreviewMode()) {
    renderEarnings(MOCK_DATA[currentPeriod]);
    bindEvents();
    return;
  }

  await loadEarningsData(currentPeriod);
  bindEvents();
}

async function loadEarningsData(period) {
  currentPeriod = period;

  document.querySelectorAll("#time-tab .tech-segmented-pill").forEach((btn) => {
    btn.classList.toggle("active", btn.dataset.period === period);
  });

  try {
    const session = ensureTechnicianSession();
    const technicianId = session.technicianUserId || session.user.id;
    const rawData = await apiRequest(`/technician/earnings?technicianUserId=${technicianId}&period=${period}`);
    const data = normalizeEarningsMoneyData(rawData, period);
    if (!data || !Array.isArray(data.chart)) {
      throw new Error("Invalid response data");
    }
    renderEarnings(data);
  } catch (error) {
    console.warn("加载收益数据失败，使用 mock 数据:", error);
    renderEarnings(MOCK_DATA[period] || MOCK_DATA.today);
  }
}

function normalizeEarningsMoneyData(data = {}, period = currentPeriod) {
  const orders = Number(data.orders || 0);
  const total = Number(data.total || 0);
  const amount = Number(data.amount || 0);

  let shouldConvert = false;
  if (period === "salary") {
    shouldConvert = Math.abs(total) >= 50000 || Math.abs(amount) >= 50000;
  } else if (orders > 0) {
    shouldConvert = total / Math.max(orders, 1) > 1000;
  } else {
    shouldConvert = Math.abs(total) >= 50000;
  }

  return {
    ...data,
    total: normalizeMoneyUnit(total, { force: shouldConvert, threshold: 1000 }),
    amount: amount,
    average_commission: data.average_commission === undefined ? data.average_commission : normalizeMoneyUnit(data.average_commission, { force: shouldConvert, threshold: 1000 }),
    avgCommission: data.avgCommission === undefined ? data.avgCommission : normalizeMoneyUnit(data.avgCommission, { force: shouldConvert, threshold: 1000 }),
    chart: Array.isArray(data.chart)
      ? data.chart.map((value) => normalizeMoneyUnit(value, { force: shouldConvert, threshold: 1000 }))
      : [],
    details: Array.isArray(data.details)
      ? data.details.map((item) => ({
          ...item,
          amount: normalizeMoneyUnit(item.amount, { force: shouldConvert, threshold: 1000 }),
          orderAmount: item.orderAmount === undefined ? item.orderAmount : normalizeMoneyUnit(item.orderAmount, { force: shouldConvert, threshold: 1000 })
        }))
      : []
  };
}

function renderEarnings(data) {
  const labelEl = document.getElementById("earnings-label");
  const totalEl = document.getElementById("earnings-total");
  const ordersEl = document.getElementById("earnings-orders");
  const amountEl = document.getElementById("earnings-amount");
  const trendEl = document.getElementById("earnings-trend");
  const amountLabelEl = document.getElementById("earnings-amount-label");
  const periodMeta = PERIOD_META[currentPeriod] || PERIOD_META.month;

  if (labelEl) labelEl.textContent = data.label || "累计收益";
  if (totalEl) totalEl.textContent = formatCurrency(data.total || 0, true);
  if (ordersEl) ordersEl.textContent = data.orders || 0;
  if (amountEl) {
    const amount = data.amount ?? 0;
    amountEl.textContent = formatCurrency(amount, false);
  }
  if (trendEl) {
    trendEl.innerHTML = `<span class="material-symbols-outlined">trending_up</span>${data.trendText || periodMeta.fallbackTrendText}`;
  }
  if (amountLabelEl) {
    amountLabelEl.textContent = data.amountLabel || periodMeta.amountLabel;
  }

  renderChart(data.chart || [], data.chartLabels || [], data.chartMaxIndex ?? -1);
  renderDetails(data.details || []);
}

function renderChart(values, labels, maxIndex) {
  const container = document.getElementById("earnings-chart");
  if (!container) return;

  if (!values.length) {
    container.innerHTML = `<div style="text-align:center;color:#999;padding:20px;">暂无数据</div>`;
    return;
  }

  const maxValue = Math.max(...values, 1);
  container.classList.toggle("single-bar", values.length === 1);
  container.style.gridTemplateColumns = values.length === 1
    ? "minmax(88px, 140px)"
    : `repeat(${values.length}, minmax(0, 1fr))`;
  container.innerHTML = values.map((value, index) => {
    const heightPercent = maxValue > 0 ? (value / maxValue) * 100 : 0;
    const isMax = index === maxIndex;
    return `
      <div class="earnings-chart-bar-wrapper">
        <div class="earnings-chart-bar-value">${value > 0 ? formatChartValue(value) : ""}</div>
        <div class="earnings-chart-bar ${isMax ? "active" : ""}" style="height:${Math.max(heightPercent, 4)}%"></div>
        <div class="earnings-chart-bar-label">${labels[index] || ""}</div>
      </div>
    `;
  }).join("");
}

function formatChartValue(value) {
  const amount = Number(value || 0);
  if (!Number.isFinite(amount) || amount <= 0) return "";
  return amount >= 1000
    ? `¥${amount.toLocaleString("zh-CN", { maximumFractionDigits: 0 })}`
    : `¥${amount.toLocaleString("zh-CN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function renderDetails(details) {
  const container = document.getElementById("earnings-details");
  if (!container) return;

  if (!details.length) {
    container.innerHTML = `
      <div class="upcoming-empty-card">
        <div class="upcoming-empty-icon"><span class="material-symbols-outlined">receipt_long</span></div>
        <p class="upcoming-empty-title">暂无收益明细</p>
        <p class="upcoming-empty-desc">完成订单后会在这里显示。</p>
      </div>
    `;
    return;
  }

  container.innerHTML = details.map((item) => `
    <div class="earnings-detail-item" data-order-id="${item.id || ''}" style="cursor: pointer;">
      <div class="earnings-detail-icon">
        <span class="material-symbols-outlined">${item.icon || "spa"}</span>
      </div>
      <div>
        <p class="earnings-detail-name">${item.name}</p>
        <p class="earnings-detail-time">${item.time}${item.duration ? `  ${item.duration}` : ""}</p>
      </div>
      <div class="earnings-detail-money">
        <div class="earnings-detail-amount">+${formatCurrency(item.amount || 0, false)}</div>
        ${item.orderAmount ? `<div class="earnings-detail-order-total">订单总计 ${formatCurrency(item.orderAmount, false)}</div>` : ""}
      </div>
    </div>
  `).join("");
}

function bindEvents() {
  document.querySelectorAll("#time-tab .tech-segmented-pill").forEach((btn) => {
    btn.addEventListener("click", () => {
      const period = btn.dataset.period;
      if (period && period !== currentPeriod) {
        loadEarningsData(period);
      }
    });
  });

  document.addEventListener("click", (event) => {
    const helpBtn = event.target.closest("#help-btn");
    if (helpBtn) {
      alert("收益计算规则：\n\n1. 服务收益 = 服务金额 × 提成比例\n2. 提成比例根据技师等级确定\n3. 收益在订单完成后结算\n\n如有疑问请联系客服。");
    }

    const viewAllBtn = event.target.closest("#view-all-details");
    if (viewAllBtn) {
      event.preventDefault();
      alert("查看全部明细功能开发中...");
    }

    const detailItem = event.target.closest(".earnings-detail-item");
    if (detailItem) {
      const orderId = detailItem.dataset.orderId;
      if (orderId) {
        showOrderDetailModal(orderId);
      }
    }
  });
}

function formatCurrency(amount, fixed = false) {
  const value = Number(amount || 0);
  return `¥${value.toLocaleString("zh-CN", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  })}`;
}

async function showOrderDetailModal(orderId) {
  try {
    const session = ensureTechnicianSession();
    const technicianId = session.technicianUserId || session.user.id;
    const data = await apiRequest(`/technician/orders/${orderId}?technicianUserId=${technicianId}`);
    
    const order = data.order;
    if (!order) {
      console.warn("Order not found");
      return;
    }

    // 创建遮罩层
    const backdrop = document.createElement("div");
    backdrop.className = "tech-modal-backdrop";
    backdrop.style.cssText = `
      position: fixed;
      inset: 0;
      background: rgba(0, 0, 0, 0.8);
      z-index: 1099;
      display: flex;
      align-items: center;
      justify-content: center;
      padding: 24px;
    `;

    // 创建中央弹窗
    const modal = document.createElement("div");
    modal.className = "tech-modal";
    modal.style.cssText = `
      width: 100%;
      max-width: 480px;
      max-height: 80vh;
      background: #1a1a1a;
      border-radius: 20px;
      border: 1px solid rgba(242, 202, 80, 0.2);
      overflow: hidden;
      display: flex;
      flex-direction: column;
    `;
    modal.innerHTML = `
      <div style="
        padding: 20px 24px;
        border-bottom: 1px solid rgba(255, 255, 255, 0.1);
        display: flex;
        align-items: center;
        justify-content: space-between;
      ">
        <div>
          <h2 style="
            margin: 0;
            color: #f2ca50;
            font-size: 18px;
            font-weight: 700;
          ">订单详情</h2>
          <p style="
            margin: 4px 0 0;
            color: #8f8777;
            font-size: 13px;
          ">查看服务与结算信息</p>
        </div>
        <button type="button" id="order-detail-close" aria-label="关闭" style="
          width: 36px;
          height: 36px;
          border: none;
          border-radius: 50%;
          background: rgba(255, 255, 255, 0.1);
          color: #f2ca50;
          cursor: pointer;
          display: flex;
          align-items: center;
          justify-content: center;
        ">
          <span class="material-symbols-outlined" style="font-size: 20px;">close</span>
        </button>
      </div>
      <div style="
        padding: 20px 24px;
        overflow-y: auto;
        flex: 1;
      ">
        ${[
          ["订单号", order.order_no || "--"],
          ["订单类型", order.order_type === "designated" ? "点钟" : "排钟"],
          ["服务项目", order.service_name || "--"],
          ["客户", order.customer_name || "散客"],
          ["房间", order.room_name || order.room_code || "--"],
          ["开始时间", order.start_time ? formatDateTime(order.start_time) : "未开始"],
          ["结束时间", order.end_time ? formatDateTime(order.end_time) : order.status === "pending" ? "未开始" : "进行中"],
          ["服务金额", formatCurrency(order.service_amount || 0)],
          ["实收金额", order.status === "completed" && order.actual_amount ? formatCurrency(order.actual_amount) : "待结算"],
          ["备注", order.note || "暂无备注"]
        ].map(([label, value]) => `
          <div style="
            display: flex;
            justify-content: space-between;
            align-items: center;
            padding: 12px 0;
            border-bottom: 1px solid rgba(255, 255, 255, 0.05);
          ">
            <span style="
              color: #8f8777;
              font-size: 14px;
            ">${label}</span>
            <span style="
              color: #f2f0ec;
              font-size: 14px;
              font-weight: 500;
              text-align: right;
            ">${value}</span>
          </div>
        `).join('')}
      </div>
    `;

    backdrop.appendChild(modal);
    document.body.appendChild(backdrop);

    const closeModal = () => {
      backdrop.remove();
    };

    modal.querySelector("#order-detail-close").addEventListener("click", closeModal);
    backdrop.addEventListener("click", (e) => {
      if (e.target === backdrop) closeModal();
    });
  } catch (error) {
    console.error("Failed to load order detail:", error);
  }
}

function formatDateTime(dateString) {
  if (!dateString) return "--";
  const date = new Date(dateString);
  return date.toLocaleString("zh-CN", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit"
  });
}

function isPreviewMode() {
  return new URLSearchParams(window.location.search).get("preview") === "1";
}

init();
