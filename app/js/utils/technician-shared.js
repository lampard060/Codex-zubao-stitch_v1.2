import { apiRequest } from "./api.js";
import { ensureTechnicianSession } from "./session.js";

export async function getTechnicianMembershipStatus() {
  const isPreview = new URLSearchParams(window.location.search).get("preview") === "1";
  if (isPreview) {
    const isJoinPage = window.location.pathname.includes("technician-join-shop");
    return {
      isSigned: !isJoinPage,
      membership: isJoinPage ? null : {
        membership_status: "active",
        shop_name: "Zenith Wellness Spa",
        shop_address: "上海市黄浦区南京东路 88 号",
        schedule_text: "排班时间：10:00 AM - 8:00 PM",
        leave_application_status: null
      }
    };
  }

  const session = ensureTechnicianSession();
  const technicianId = session.technicianUserId || session.user.id;
  const data = await apiRequest(`/technician/membership?technicianUserId=${technicianId}`);
  return {
    isSigned: data.currentMembership?.membership_status === "active",
    membership: data.currentMembership || null
  };
}

export function renderBottomNav(currentPage, isSigned) {
  const nav = document.getElementById("technician-bottom-nav");
  if (!nav) return;

  nav.classList.remove("nav-2", "nav-3");
  nav.classList.add(isSigned ? "nav-3" : "nav-2");

  if (isSigned) {
    nav.innerHTML = `
      <a class="nav-item ${currentPage === "home" ? "active" : ""}" href="./technician-home.html">
        <span class="material-symbols-outlined">grid_view</span>
        <span>工作台</span>
      </a>
      <a class="nav-item ${currentPage === "earnings" ? "active" : ""}" href="./technician-earnings.html">
        <span class="material-symbols-outlined">payments</span>
        <span>收益</span>
      </a>
      <a class="nav-item ${currentPage === "profile" ? "active" : ""}" href="./technician-profile.html">
        <span class="material-symbols-outlined">person</span>
        <span>我的</span>
      </a>
    `;
    return;
  }

  nav.innerHTML = `
    <a class="nav-item ${currentPage === "apply" ? "active" : ""}" href="./technician-join-shop.html">
      <span class="material-symbols-outlined">calendar_today</span>
      <span>申请</span>
    </a>
    <a class="nav-item ${currentPage === "profile" ? "active" : ""}" href="./technician-profile.html">
      <span class="material-symbols-outlined">person</span>
      <span>我的</span>
    </a>
  `;
}

export function renderTopbar(options = {}) {
  const {
    variant = "default",
    title = "足宝",
    showBack = false,
    subtitle = "",
    showNotification = false,
    showSettings = false,
    showHelp = false,
    showStatus = false,
    statusOn = true,
    statusText = "待钟中",
    avatarUrl = "./zubao-tech-icon.png"
  } = options;

  const topbar = document.getElementById("technician-topbar");
  if (!topbar) return;

  // 工作台页面特殊处理
  if (variant === "home") {
    topbar.innerHTML = `
      <button class="tech-topbar-action" type="button" data-nav-back="1" aria-label="返回"></button>
      <div class="tech-topbar-title small-caps">工作台</div>
      <div class="tech-topbar-actions">
        <button class="tech-status-pill ${statusOn ? "is-on" : "is-resting"}" id="status-switch" type="button" aria-pressed="${String(statusOn)}">
          <span id="status-mode-text">${statusText}</span>
        </button>
      </div>
    `;
    bindBackNavigation(topbar);
    return;
  }

  // 休息页面特殊处理
  if (variant === "rest") {
    topbar.innerHTML = `
      <button class="tech-topbar-action" type="button" data-nav-back="1" aria-label="返回">
        <span class="material-symbols-outlined">arrow_back</span>
      </button>
      <div class="tech-topbar-title small-caps">工作台</div>
      <div class="tech-topbar-actions">
        <span class="tech-status-pill is-resting">休息中</span>
      </div>
    `;
    bindBackNavigation(topbar);
    return;
  }

  const left = showBack
    ? `<button class="tech-topbar-action ${variant === "join" ? "gold" : ""}" type="button" data-nav-back="1" aria-label="返回">
        <span class="material-symbols-outlined">arrow_back</span>
      </button>`
    : `<span></span>`;

  const titleClass = variant === "join" || variant === "home" ? "tech-topbar-title small-caps" : "tech-topbar-title";
  let titleText = "我的";
  if (variant === "join") {
    titleText = "FOOT TREASURE";
  } else if (variant === "home") {
    titleText = "工作台";
  } else if (title && title.includes("收益")) {
    titleText = "收益";
  }

  const actionButtons = [];
  if (showNotification) {
    actionButtons.push(`<button class="topbar-btn" id="notification-btn"><span class="material-symbols-outlined">notifications</span></button>`);
  }
  if (showSettings) {
    actionButtons.push(`<button class="topbar-btn" id="settings-btn"><span class="material-symbols-outlined">settings</span></button>`);
  }
  if (showHelp) {
    actionButtons.push(`<button class="topbar-btn" id="help-btn"><span class="material-symbols-outlined">help</span></button>`);
  }
  if (showStatus) {
    actionButtons.push(`<button class="tech-status-pill ${statusOn ? "is-on" : "is-resting"}" id="status-switch" type="button" aria-pressed="${String(statusOn)}"><span id="status-mode-text">${statusText}</span></button>`);
  }

  if (variant === "brand") {
    topbar.innerHTML = `
      <div class="tech-topbar-brand">
        <img src="${avatarUrl}" alt="头像" class="technician-mobile-avatar" id="topbar-avatar">
        <span>足宝</span>
      </div>
      <div class="tech-topbar-title">${title}</div>
      ${actionButtons.length ? `<div class="tech-topbar-actions">${actionButtons.join("")}</div>` : "<span></span>"}
    `;
    bindBackNavigation(topbar);
    return;
  }

  topbar.innerHTML = `
    ${left}
    <div class="${titleClass}">${titleText}${subtitle ? `<span class="sr-only">${subtitle}</span>` : ""}</div>
    ${actionButtons.length ? `<div class="tech-topbar-actions">${actionButtons.join("")}</div>` : "<span></span>"}
  `;
  bindBackNavigation(topbar);
}

export function renderApplyTopbar(title = "申请加入门店") {
  const topbar = document.getElementById("technician-topbar");
  if (!topbar) return;

  topbar.innerHTML = `
    <button class="tech-topbar-action gold" type="button" data-nav-back="1" aria-label="返回"><span class="material-symbols-outlined">arrow_back</span></button>
    <div class="tech-topbar-title small-caps">申请<span class="sr-only">${title}</span></div>
    <span></span>
  `;
  bindBackNavigation(topbar);
}

export function formatAmount(amount) {
  return "¥" + Number(amount || 0).toLocaleString("zh-CN", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  });
}

export function normalizeMoneyUnit(value, { force = false, threshold = 1000 } = {}) {
  const amount = Number(value || 0);
  if (!Number.isFinite(amount)) return 0;
  if (force) return Number((amount / 100).toFixed(2));
  if (Number.isInteger(amount) && Math.abs(amount) >= threshold) {
    return Number((amount / 100).toFixed(2));
  }
  return amount;
}

export function formatNumber(num) {
  return Number(num).toLocaleString("zh-CN");
}

export function safeAvatarUrl(url, fallback = "./zubao-tech-icon.png") {
  if (!url || typeof url !== "string") return fallback;
  const trimmed = url.trim();
  if (!trimmed) return fallback;
  return trimmed;
}

export function logout() {
  localStorage.removeItem("zubao_session");
  window.location.href = "./login.html";
}

function bindBackNavigation(topbar) {
  const backBtn = topbar.querySelector("[data-nav-back]");
  if (!backBtn) return;
  backBtn.addEventListener("click", () => {
    if (window.history.length > 1) {
      window.history.back();
      return;
    }
    window.location.href = "./login.html";
  });
}
