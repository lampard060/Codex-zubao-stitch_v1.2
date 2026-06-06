import { initIconFallback } from "../utils/icon-fallback.js";
import { initBrandingAssets } from "../utils/branding.js";
import { apiRequest } from "../utils/api.js";
import { ensureTechnicianSession } from "../utils/session.js";
import { registerTechnicianServiceWorker } from "../utils/pwa.js";
import { formatAmount, getTechnicianMembershipStatus, renderBottomNav, renderTopbar } from "../utils/technician-shared.js?v=20260515-redesign";

let currentStatus = "available";
let countdownInterval = null;
let restTimerInterval = null;
let restStartTime = null;

const PREVIEW_HOME_DATA = {
  technician_name: "林婉儿",
  employee_id: "T-1024",
  status: "available",
  membership: {
    shop_name: "足宝静安门店",
    shop_address: "上海市静安区南京西路 188 号 3 层"
  },
  today_pending: 2,
  today_in_service: 0,
  month: "6 月",
  monthSummary: {
    completed_order_count: 48,
    month_revenue: 4260
  },
  summary: {
    today_completed_orders: 3,
    today_income: 298
  },
  orders: []
};

async function loadHomeData() {
  try {
    const session = ensureTechnicianSession();
    const technicianId = session.technicianUserId || session.user.id;
    const data = await apiRequest(`/technician/home?technicianUserId=${technicianId}`);

    const summary = data.summary || {};
    const todayOrders = data.today_orders ?? summary.today_completed_orders ?? 0;
    const todayIncome = data.today_income ?? summary.today_income ?? 0;

    const todayOrdersEl = document.getElementById("today-orders");
    const todayIncomeEl = document.getElementById("today-income");
    if (todayOrdersEl) todayOrdersEl.textContent = todayOrders;
    if (todayIncomeEl) todayIncomeEl.textContent = formatMoneyValue(todayIncome);

    currentStatus = data.status || data.serviceStatus || "available";
    renderHomeHero(data);
    renderOrders(data.orders || []);
    renderHomeTopbarForState(currentStatus);
    updateStatusUI(currentStatus);
  } catch (e) {
    console.warn("加载工作台数据失败:", e);
    renderHomeHero(PREVIEW_HOME_DATA);
    renderOrders([]);
  }
}

function renderHomeHero(data = {}) {
  const heroSection = document.getElementById("home-hero-section");
  if (!heroSection) return;

  const membership = data.membership || {};
  const monthSummary = data.monthSummary || {};
  const employeeId = data.employee_id || "未设置工号";
  const technicianName = data.technician_name || data.profile?.name || "技师";
  const shopName = membership.shop_name || "暂未加入门店";
  const monthOrders = Number(monthSummary.completed_order_count || 0);
  const monthRevenue = Number(monthSummary.month_revenue || 0);
  const pendingCount = Number(data.today_pending || 0);
  const inServiceCount = Number(data.today_in_service || 0);
  const monthLabel = formatMonthSummaryLabel(data.month);

  heroSection.style.display = "";
  heroSection.innerHTML = `
    <div class="home-hero-head">
      <div class="home-hero-copy">
        <p class="home-hero-kicker">今日工作概览</p>
        <h1 class="home-hero-title">${escapeHtml(technicianName)}</h1>
        <p class="home-hero-subtitle">${escapeHtml(shopName)} · ${escapeHtml(employeeId)}</p>
      </div>
      <div class="home-hero-metric-card">
        <span class="home-hero-metric-label">${escapeHtml(monthLabel)}累计营业额</span>
        <strong class="home-hero-metric-value">${formatAmount(monthRevenue)}</strong>
        <span class="home-hero-metric-meta">${monthOrders} 单完成</span>
      </div>
    </div>
    <div class="home-hero-chips">
      <span class="home-hero-chip"><span class="home-hero-chip-label">待服务</span><strong>${pendingCount}</strong></span>
      <span class="home-hero-chip"><span class="home-hero-chip-label">服务中</span><strong>${inServiceCount}</strong></span>
      <span class="home-hero-chip"><span class="home-hero-chip-label">今日节奏</span><strong>${pendingCount + inServiceCount > 0 ? "忙碌中" : "待派单"}</strong></span>
    </div>
  `;
}

function renderOrders(orders) {
  const currentContainer = document.getElementById("current-orders-container");
  const completedContainer = document.getElementById("completed-orders-container");
  if (!currentContainer || !completedContainer) return;
  const taskSection = document.getElementById("task-section");
  const statGrid = document.getElementById("stat-grid-section");
  const currentOrdersSection = document.getElementById("current-orders-section");
  const completedOrdersSection = document.getElementById("completed-orders-section");
  const checkoutSection = document.getElementById("checkout-section");
  const attendanceBtn = document.getElementById("attendance-btn");

  if (!orders.length) {
    renderHomeTopbarForState(currentStatus);

    if (currentStatus === "unavailable") {
      statGrid.style.display = "none";
      currentOrdersSection.style.display = "none";
      completedOrdersSection.style.display = "none";
      checkoutSection.style.display = "none";
      taskSection.innerHTML = renderRestingCard();
      if (attendanceBtn) attendanceBtn.hidden = true;
      bindEmptyStateActions(taskSection);
      startRestTimer();
    } else {
      statGrid.style.display = "";
      currentOrdersSection.style.display = "none";
      completedOrdersSection.style.display = "none";
      checkoutSection.style.display = "";
      taskSection.innerHTML = renderWaitingCard();
      if (attendanceBtn) {
        attendanceBtn.hidden = false;
        attendanceBtn.textContent = "下班打卡";
      }
      bindEmptyStateActions(taskSection);
    }
    return;
  }

  const currentOrders = orders.filter(o => o.status === "pending" || o.status === "in_service");
  const completedOrders = orders.filter(o => o.status === "completed" || o.status === "cancelled");

  renderHomeTopbarForState(currentStatus);
  statGrid.style.display = "";
  checkoutSection.style.display = "";

  if (currentOrders.length) {
    currentOrdersSection.style.display = "";
    const primaryOrder = currentOrders[0];
    currentContainer.innerHTML = renderCurrentOrderCard(primaryOrder);
    currentContainer.querySelectorAll(".technician-order-btn[data-action]").forEach((btn) => {
      btn.addEventListener("click", handleOrderAction);
    });
    startCountdowns(currentOrders);
  } else {
    currentOrdersSection.style.display = "none";
  }

  if (completedOrders.length) {
    completedOrdersSection.style.display = "";
    completedContainer.innerHTML = completedOrders.slice(0, 5).map((order) => {
      let timeText = "完成";
      if (order.start_time) {
        const d = new Date(order.start_time);
        timeText = `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")} 完成`;
      }
      return `
        <div class="order-card">
          <div class="order-info">
            <h4>${escapeHtml(order.service_name || "按摩")}</h4>
            <p>${escapeHtml(order.room || "101")} · ${timeText}</p>
          </div>
          <div class="order-amount-meta">
            <div class="order-amount">+${formatAmount(getOrderIncome(order))}</div>
            <div class="order-amount-note">技师收益</div>
          </div>
        </div>
      `;
    }).join("");
  } else {
    completedOrdersSection.style.display = "none";
  }

  if (attendanceBtn) {
    attendanceBtn.hidden = false;
    attendanceBtn.textContent = "下班打卡";
  }
}

function renderCurrentOrderCard(order) {
  const isInService = order.status === "in_service";
  const isPending = order.status === "pending";
  const totalSeconds = order.total_seconds || (order.duration_minutes || 90) * 60;
  const totalMinutes = order.duration_minutes || Math.max(1, Math.round(totalSeconds / 60));
  const progressPercent = Math.max(0, Math.min(100, ((totalSeconds - (order.remaining_seconds || 0)) / totalSeconds) * 100));

  const statusText = isInService ? "服务中" : isPending ? "待开始" : "已完成";
  const roomText = order.room || "VIP 包间 08";
  const orderNo = order.order_no || order.id || "NO.20241024008";
  const serviceName = order.service_name || "深度经络按摩";
  const price = order.price || order.service_amount || order.actual_amount || 150;

  let timeRange = "14:00 - 15:30";
  if (order.start_time && order.end_time) {
    const startD = new Date(order.start_time);
    const endD = new Date(order.end_time);
    timeRange = `${String(startD.getHours()).padStart(2, "0")}:${String(startD.getMinutes()).padStart(2, "0")} - ${String(endD.getHours()).padStart(2, "0")}:${String(endD.getMinutes()).padStart(2, "0")}`;
  }

  const remainingSeconds = order.remaining_seconds || totalSeconds;
  const remainingMinutes = Math.floor(remainingSeconds / 60);
  const remainingSecs = remainingSeconds % 60;
  const remainingText = `${String(remainingMinutes).padStart(2, "0")}:${String(remainingSecs).padStart(2, "0")}`;

  let actionButtons = `
    <button class="technician-order-btn secondary" type="button" data-action="detail" data-order-id="${order.id}">
      查看详情
    </button>
  `;
  if (isPending) {
    actionButtons += `
      <button class="technician-order-btn primary" type="button" data-action="start" data-order-id="${order.id}">
        开始服务
      </button>
    `;
  } else if (isInService) {
    actionButtons += `
      <button class="technician-order-btn primary" type="button" data-action="complete" data-order-id="${order.id}">
        结束服务
      </button>
    `;
  }

  return `
    <article class="current-order-card" data-order-id="${order.id}" data-order-status="${order.status}">
      <div class="current-order-header">
        <h3 class="current-order-room">${escapeHtml(roomText)}</h3>
        <span class="current-order-status-tag">${statusText}</span>
      </div>
      <div class="current-order-details">
        <div class="current-order-row">
          <span class="current-order-label">订单号</span>
          <span class="current-order-value">${escapeHtml(orderNo)}</span>
        </div>
        <div class="current-order-row">
          <span class="current-order-label">项目名称</span>
          <span class="current-order-value">${escapeHtml(serviceName)}</span>
        </div>
        <div class="current-order-row">
          <span class="current-order-label">价格</span>
          <span class="current-order-value">${formatAmount(price)}</span>
        </div>
        <div class="current-order-row">
          <span class="current-order-label">时间</span>
          <span class="current-order-value">${timeRange}</span>
        </div>
      </div>
      <div class="current-order-divider"></div>
      <div class="current-order-remaining-section">
        <div class="current-order-remaining-info">
          <span class="current-order-remaining-label">剩余时间</span>
          <span class="current-order-remaining-time" id="countdown-${order.id}">${remainingText}</span>
        </div>
        ${isInService ? `
          <div class="current-order-remaining-ring">
            <svg viewBox="0 0 64 64" width="64" height="64">
              <circle cx="32" cy="32" r="28" fill="none" stroke="rgba(255,255,255,0.06)" stroke-width="4"/>
              <circle cx="32" cy="32" r="28" fill="none" stroke="var(--tech-gold)" stroke-width="4"
                stroke-dasharray="${2 * Math.PI * 28}"
                stroke-dashoffset="${2 * Math.PI * 28 * (1 - progressPercent / 100)}"
                stroke-linecap="round"
                transform="rotate(-90 32 32)"
                id="progress-ring-${order.id}"/>
            </svg>
          </div>
        ` : ""}
      </div>
      <div class="current-order-actions">${actionButtons}</div>
    </article>
  `;
}

function escapeHtml(text) {
  if (!text) return "";
  const div = document.createElement("div");
  div.textContent = String(text);
  return div.innerHTML;
}

function renderHomeTopbarForState(status) {
  renderTopbar({
    variant: "home",
    title: "足宝",
    showBack: true,
    showStatus: true,
    statusOn: status !== "unavailable",
    statusText: status === "unavailable" ? "休息中" : status === "in_service" ? "服务中" : "待钟中"
  });
}

function getStatusText(status) {
  return status === "unavailable" ? "休息中" : status === "in_service" ? "服务中" : "待钟中";
}

function getOrderIncome(order = {}) {
  const commission = Number(order.commission_amount || 0);
  const designatedBonus = Number(order.designated_bonus_amount || 0);
  const income = commission + designatedBonus;
  return income > 0 ? income : Number(order.actual_amount || 0);
}

function formatMoneyValue(amount) {
  return Number(amount || 0).toLocaleString("zh-CN", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  });
}

function formatMonthSummaryLabel(monthText) {
  const raw = String(monthText || "").trim();
  if (!raw) return "本月";

  const yearMonthMatch = raw.match(/^(\d{4})[-/年]\s*(\d{1,2})/);
  if (yearMonthMatch) {
    return `${yearMonthMatch[1]} 年 ${Number(yearMonthMatch[2])} 月`;
  }

  const shortMonthMatch = raw.match(/^(\d{1,2})\s*月$/);
  if (shortMonthMatch) {
    return `${Number(shortMonthMatch[1])} 月`;
  }

  return raw;
}

function renderRestingCard() {
  const storedRestStart = localStorage.getItem("rest_start_time");
  restStartTime = storedRestStart ? parseInt(storedRestStart, 10) : Date.now();
  const todayStats = JSON.parse(localStorage.getItem("rest_stats_today") || '{"count":0,"totalMinutes":0}');

  return `
    <section class="rest-status-card" aria-label="休息中">
      <div class="rest-icon">
        <svg viewBox="0 0 64 80" aria-hidden="true">
          <path d="M32 8c-13.3 0-24 10.7-24 24 0 8.4 4.3 15.8 10.9 20.1L32 72l13.1-19.9C51.7 47.8 56 40.4 56 32c0-13.3-10.7-24-24-24z" fill="none" stroke="currentColor" stroke-width="4" stroke-linejoin="round"/>
          <path d="M32 20c-6.6 0-12 5.4-12 12s5.4 12 12 12 12-5.4 12-12-5.4-12-12-12z" fill="currentColor"/>
        </svg>
      </div>
      <h2 class="rest-title">休息中</h2>
      <p class="rest-desc">您当前处于休息状态，不会接收新的订单</p>
      <div class="rest-time">
        <span class="material-symbols-outlined">schedule</span>
        <span id="rest-duration">00:00:00</span>
      </div>
    </section>

    <section class="rest-actions">
      <button class="btn-primary" id="rest-resume-btn" type="button">
        <span class="material-symbols-outlined">play_circle</span>
        上班打卡
      </button>
    </section>

    <section class="rest-stats">
      <h3>今日休息统计</h3>
      <div class="rest-stats-grid">
        <div class="rest-stat-item">
          <strong id="rest-count">${todayStats.count}</strong>
          <span>休息次数</span>
        </div>
        <div class="rest-stat-item">
          <strong id="rest-total">${formatRestTotal(todayStats.totalMinutes)}</strong>
          <span>累计休息</span>
        </div>
      </div>
    </section>
  `;
}

function formatRestTotal(totalMinutes) {
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  return `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}`;
}

function startRestTimer() {
  if (restTimerInterval) {
    clearInterval(restTimerInterval);
    restTimerInterval = null;
  }

  updateRestDuration();
  restTimerInterval = setInterval(updateRestDuration, 1000);
}

function updateRestDuration() {
  const durationEl = document.getElementById("rest-duration");
  if (!durationEl || !restStartTime) return;

  const elapsed = Math.floor((Date.now() - restStartTime) / 1000);
  const hours = Math.floor(elapsed / 3600);
  const minutes = Math.floor((elapsed % 3600) / 60);
  const seconds = elapsed % 60;

  durationEl.textContent = `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
}

function renderWaitingCard() {
  return `
    <section class="home-waiting-card">
      <div class="waiting-icon">
        <svg viewBox="0 0 64 80" aria-hidden="true">
          <path d="M15 8h34v8c0 10-6 17-14 24 8 7 14 14 14 24v8H15v-8c0-10 6-17 14-24-8-7-14-14-14-24V8Z" fill="none" stroke="currentColor" stroke-width="4" stroke-linejoin="round"/>
          <path d="M22 18h20c-1 8-5 12-10 17-5-5-9-9-10-17Z" fill="currentColor"/>
          <path d="M32 45c5 5 9 9 10 17H22c1-8 5-12 10-17Z" fill="currentColor"/>
          <path d="M20 8h24M20 72h24" stroke="currentColor" stroke-width="6" stroke-linecap="round"/>
        </svg>
      </div>
      <h3 class="waiting-title">正在等待门店派单...</h3>
      <p class="waiting-desc">保持设备在线，新订单将在此处显示</p>
      <button class="btn-primary" id="create-order-btn" type="button">
        <span class="material-symbols-outlined">add_circle</span>
        新增订单
      </button>
    </section>
  `;
}

function bindEmptyStateActions(container) {
  const createOrderBtn = container.querySelector("#create-order-btn, #empty-create-order-btn");
  if (createOrderBtn && !createOrderBtn.dataset.bound) {
    createOrderBtn.dataset.bound = "1";
    createOrderBtn.addEventListener("click", handleCreateOrderClick);
  }

  const restResumeBtn = container.querySelector("#rest-resume-btn");
  if (restResumeBtn) {
    restResumeBtn.addEventListener("click", async () => {
      const elapsedMinutes = restStartTime ? Math.floor((Date.now() - restStartTime) / 60000) : 0;

      const todayStats = JSON.parse(localStorage.getItem("rest_stats_today") || '{"count":0,"totalMinutes":0}');
      todayStats.count += 1;
      todayStats.totalMinutes += elapsedMinutes;
      localStorage.setItem("rest_stats_today", JSON.stringify(todayStats));

      localStorage.removeItem("rest_start_time");

      if (restTimerInterval) {
        clearInterval(restTimerInterval);
        restTimerInterval = null;
      }

      try {
        await switchStatus("available");
      } catch (err) {
        console.error("切换状态失败:", err);
      }
      window.location.reload();
    });
  }
}

function handleCreateOrderClick() {
  alert("当前由门店前台或商家端创建订单，技师端暂不支持直接新增订单。");
}

async function switchStatus(newStatus) {
  if (newStatus === currentStatus) return;

  if (isPreviewMode()) {
    currentStatus = newStatus;
    updateStatusUI(newStatus);
    renderOrders([]);
    bindStatusSwitch();
    return;
  }

  try {
    const session = ensureTechnicianSession();
    const technicianId = session.technicianUserId || session.user.id;
    const result = await apiRequest("/technician/status", {
      method: "POST",
      body: {
        technicianUserId: technicianId,
        attendanceStatus: newStatus === "unavailable" ? "resting" : "on_duty",
        serviceStatus: newStatus === "unavailable" ? "resting" : newStatus
      }
    });

    console.log("Status switch result:", result);
    currentStatus = newStatus;
    updateStatusUI(newStatus);
    renderOrders([]);
    bindStatusSwitch();
  } catch (e) {
    console.error("切换状态失败:", e);
    throw e;
  }
}

function startCountdowns(orders) {
  if (countdownInterval) {
    clearInterval(countdownInterval);
    countdownInterval = null;
  }

  const activeOrders = orders.filter((order) => order.status === "in_service" && order.remaining_seconds > 0);
  if (!activeOrders.length) return;

  countdownInterval = setInterval(() => {
    let hasActive = false;
    activeOrders.forEach((order) => {
      order.remaining_seconds = Math.max(0, order.remaining_seconds - 1);

      const countdownEl = document.getElementById(`countdown-${order.id}`);
      if (countdownEl) {
        const remainingMinutes = Math.floor(order.remaining_seconds / 60);
        const remainingSecs = order.remaining_seconds % 60;
        countdownEl.textContent = `${String(remainingMinutes).padStart(2, "0")}:${String(remainingSecs).padStart(2, "0")}`;
      }

      const totalSeconds = order.total_seconds || (order.duration_minutes || 90) * 60;
      const progressPercent = totalSeconds > 0 ? ((totalSeconds - order.remaining_seconds) / totalSeconds) * 100 : 0;
      const ringEl = document.getElementById(`progress-ring-${order.id}`);
      if (ringEl) {
        const circumference = 2 * Math.PI * 28;
        ringEl.setAttribute("stroke-dashoffset", circumference * (1 - progressPercent / 100));
      }

      if (order.remaining_seconds > 0) hasActive = true;
    });

    if (!hasActive && countdownInterval) {
      clearInterval(countdownInterval);
      countdownInterval = null;
    }
  }, 1000);
}

function formatTime(seconds) {
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `${String(mins).padStart(2, "0")}:${String(secs).padStart(2, "0")}`;
}

async function handleOrderAction(e) {
  const btn = e.target.closest("[data-action]");
  if (!btn) return;

  const action = btn.dataset.action;
  const orderId = btn.dataset.orderId;
  if (action === "detail") {
    alert("订单详情功能开发中...");
    return;
  }

  btn.disabled = true;

  try {
    if (action === "start") {
      await apiRequest(`/technician/orders/${orderId}/start`, {
        method: "POST",
        body: {}
      });
      alert("服务已开始");
    } else if (action === "complete") {
      const confirmed = confirm("确认结束服务吗？");
      if (!confirmed) {
        btn.disabled = false;
        return;
      }
      await apiRequest(`/technician/orders/${orderId}/complete`, {
        method: "POST",
        body: {}
      });
      alert("服务已结束");
    }

    await loadHomeData();
  } catch (err) {
    console.error("订单操作失败:", err);
    alert(`操作失败：${err.message || "请重试"}`);
    btn.disabled = false;
  }
}

function updateStatusUI(status) {
  const switchBtn = document.getElementById("status-switch");
  const statusText = document.getElementById("status-mode-text");
  const attendanceBtn = document.getElementById("attendance-btn");
  const isOnDuty = status !== "unavailable";

  if (switchBtn) {
    switchBtn.classList.toggle("is-on", isOnDuty);
    switchBtn.setAttribute("aria-pressed", String(isOnDuty));
  }

  if (statusText) {
    statusText.textContent = getStatusText(status);
  }

  if (attendanceBtn) {
    attendanceBtn.textContent = isOnDuty ? "下班打卡" : "上班打卡";
  }
}

function bindStatusSwitch() {
  const switchBtn = document.getElementById("status-switch");
  if (!switchBtn || switchBtn.dataset.bound) return;
  switchBtn.dataset.bound = "1";

  switchBtn.addEventListener("click", async () => {
    await handleAttendanceAction();
  });
}

function bindAttendanceButton() {
  const attendanceBtn = document.getElementById("attendance-btn");
  if (!attendanceBtn || attendanceBtn.dataset.bound) return;
  attendanceBtn.dataset.bound = "1";

  attendanceBtn.addEventListener("click", async () => {
    await handleAttendanceAction();
  });
}

async function handleAttendanceAction() {
  try {
    if (currentStatus === "unavailable") {
      await switchStatus("available");
    } else {
      const confirmed = confirm("确定要下班打卡进入休息状态吗？");
      if (!confirmed) return;
      await switchStatus("unavailable");
      localStorage.setItem("rest_start_time", Date.now().toString());
      window.location.href = "./technician-rest.html";
    }
  } catch (error) {
    console.error("打卡状态切换失败:", error);
    alert(`打卡失败：${error.message || "请稍后重试"}`);
  }
}

async function init() {
  initIconFallback();
  initBrandingAssets();
  registerTechnicianServiceWorker();

  if (isPreviewMode()) {
    renderPreviewHome();
    return;
  }

  try {
    ensureTechnicianSession();
  } catch (e) {
    console.warn("缺少技师登录状态，已保留工作台静态预览:", e);
    renderPreviewHome();
    return;
  }

  let isSigned = false;
  try {
    const membership = await getTechnicianMembershipStatus();
    isSigned = membership.isSigned;
  } catch (e) {
    console.warn("获取签约状态失败:", e);
  }

  if (!isSigned) {
    window.location.href = "./technician-join-shop.html";
    return;
  }

  renderBottomNav("home", isSigned);
  bindStatusSwitch();
  bindAttendanceButton();
  await loadHomeData();
}

init();

function isPreviewMode() {
  return new URLSearchParams(window.location.search).get("preview") === "1";
}

function renderPreviewHome() {
  currentStatus = PREVIEW_HOME_DATA.status;
  renderBottomNav("home", true);
  renderHomeTopbarForState(currentStatus);
  renderHomeHero(PREVIEW_HOME_DATA);

  const todayOrdersEl = document.getElementById("today-orders");
  const todayIncomeEl = document.getElementById("today-income");
  const taskSection = document.getElementById("task-section");
  const statGrid = document.getElementById("stat-grid-section");
  const checkoutSection = document.getElementById("checkout-section");

  if (todayOrdersEl) {
    todayOrdersEl.textContent = PREVIEW_HOME_DATA.today_orders ?? PREVIEW_HOME_DATA.summary?.today_completed_orders ?? 0;
  }
  if (todayIncomeEl) {
    todayIncomeEl.textContent = formatMoneyValue(PREVIEW_HOME_DATA.today_income ?? PREVIEW_HOME_DATA.summary?.today_income ?? 0);
  }
  if (statGrid) statGrid.style.display = "";
  if (taskSection) {
    taskSection.innerHTML = renderWaitingCard();
    bindEmptyStateActions(taskSection);
  }
  if (checkoutSection) checkoutSection.style.display = "";

  updateStatusUI(currentStatus);
  bindStatusSwitch();
  bindAttendanceButton();
}
