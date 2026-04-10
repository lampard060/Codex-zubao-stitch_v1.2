const API_BASE_URL = `${window.location.protocol}//${window.location.hostname || "127.0.0.1"}:3001/api/v1`;
const STORAGE_KEY = "zubao_session";
const DEFAULT_SHOP_ID = "30000000-0000-0000-0000-000000000001";

function getSession() {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY) || "null");
  } catch (error) {
    return null;
  }
}

function setSession(session) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(session));
}

function clearSession() {
  localStorage.removeItem(STORAGE_KEY);
}

function getHomePathByRole(role) {
  if (role === "merchant") return "./merchant-dashboard.html";
  if (role === "technician") return "./technician-home.html";
  return "./login.html";
}

function formatCurrency(value) {
  return new Intl.NumberFormat("zh-CN", {
    style: "currency",
    currency: "CNY",
    maximumFractionDigits: 2
  }).format(Number(value || 0));
}

function formatAmountInputValue(value) {
  if (value === undefined || value === null || value === "") {
    return "";
  }
  return Number(value || 0).toFixed(2);
}

function parseAmountInputValue(value) {
  const normalized = String(value || "").trim().replace(/[^\d.]/g, "");
  if (!normalized) {
    return 0;
  }
  return Math.round(Number(normalized) * 100);
}

function normalizeAmountInputElement(input) {
  if (!input) return;
  const normalized = String(input.value || "").trim();
  if (!normalized) {
    input.value = "";
    return;
  }
  input.value = formatAmountInputValue(normalized);
}

function bindAmountInputNormalization(input) {
  if (!input) return;
  input.addEventListener("blur", () => {
    normalizeAmountInputElement(input);
  });
}

function formatMonth(value) {
  if (!value) return "";
  const date = new Date(`${value}-01T00:00:00`);
  return `${date.getFullYear()} 年 ${date.getMonth() + 1} 月`;
}

function formatDateTime(value) {
  if (!value) return "--";
  return new Intl.DateTimeFormat("zh-CN", {
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit"
  }).format(new Date(value));
}

function toDateTimeLocalValue(value) {
  if (!value) return "";
  const date = new Date(value);
  const offset = date.getTimezoneOffset();
  const localDate = new Date(date.getTime() - offset * 60 * 1000);
  return localDate.toISOString().slice(0, 16);
}

function getInitial(name = "") {
  return name.trim().slice(0, 1) || "足";
}

function showFieldFeedback(elementId, message, isError = false) {
  const element = document.getElementById(elementId);
  if (!element) return;
  element.hidden = !message;
  element.textContent = message || "";
  element.style.color = isError ? "#b42318" : "var(--primary)";
}

function downloadTextFile(filename, content, mimeType = "text/plain;charset=utf-8") {
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

async function apiRequest(path, { method = "GET", body, headers = {} } = {}) {
  const session = getSession();
  const response = await fetch(`${API_BASE_URL}${path}`, {
    method,
    headers: {
      "Content-Type": "application/json",
      ...(session?.token ? { Authorization: `Bearer ${session.token}` } : {}),
      ...headers
    },
    body: body ? JSON.stringify(body) : undefined
  });

  const payload = await response.json().catch(() => ({
    ok: false,
    error: { message: "响应解析失败" }
  }));

  if (!response.ok || payload.ok === false) {
    throw new Error(payload?.error?.message || "请求失败");
  }

  return payload.data;
}

function bindRoleTabs() {
  document.querySelectorAll("[data-role-tabs]").forEach((container) => {
    const panels = document.querySelectorAll(`[data-role-panel="${container.dataset.roleTabs}"]`);
    container.querySelectorAll("button").forEach((button) => {
      button.addEventListener("click", () => {
        container.querySelectorAll("button").forEach((item) => item.classList.remove("active"));
        panels.forEach((panel) => {
          panel.hidden = panel.dataset.role !== button.dataset.role;
        });
        button.classList.add("active");
      });
    });
  });
}

function bindApplicationToggles() {
  document.querySelectorAll("[data-application-toggle]").forEach((button) => {
    button.addEventListener("click", () => {
      const target = document.querySelector(button.dataset.applicationToggle);
      if (!target) return;
      target.scrollIntoView({ behavior: "smooth", block: "start" });
    });
  });
}

function ensureMerchantSession() {
  const session = getSession();
  if (!session?.token || session?.user?.role !== "merchant") {
    location.href = "./login.html";
    throw new Error("Missing merchant session");
  }
  return session;
}

function ensureTechnicianSession() {
  const session = getSession();
  if (!session?.token || session?.user?.role !== "technician") {
    location.href = "./login.html";
    throw new Error("Missing technician session");
  }
  return session;
}

function renderFallback(container, message) {
  if (!container) return;
  container.innerHTML = `<div class="small" style="padding: 18px 0; color: var(--muted)">${message}</div>`;
}

function injectLogoutAction() {
  const session = getSession();
  if (!session?.token || document.body.dataset.page === "login") {
    return;
  }

  const topbarActions = document.querySelector(".topbar-actions");
  if (!topbarActions || topbarActions.querySelector("[data-logout-button]")) {
    return;
  }

  const logoutButton = document.createElement("button");
  logoutButton.className = "ghost-button";
  logoutButton.dataset.logoutButton = "true";
  logoutButton.textContent = "退出登录";
  logoutButton.addEventListener("click", () => {
    clearSession();
    location.href = "./login.html";
  });
  topbarActions.prepend(logoutButton);
}

function initTechnicianPwa() {
  const page = document.body.dataset.page || "";
  if (!page.startsWith("technician-")) return;
  if (!("serviceWorker" in navigator)) return;

  const mainPanel = document.querySelector(".main-panel");
  if (mainPanel && !document.getElementById("technician-network-banner")) {
    const networkBanner = document.createElement("section");
    networkBanner.className = "network-status-banner";
    networkBanner.id = "technician-network-banner";
    networkBanner.hidden = navigator.onLine;
    networkBanner.innerHTML = `
      <div class="network-status-title">当前网络不可用</div>
      <div class="network-status-copy">你仍可查看已缓存页面，联网后数据会继续同步。</div>
    `;
    mainPanel.insertBefore(networkBanner, mainPanel.firstChild);

    const updateNetworkBanner = () => {
      networkBanner.hidden = navigator.onLine;
      if (navigator.onLine) {
        networkBanner.classList.add("success");
        networkBanner.querySelector(".network-status-title").textContent = "网络已恢复";
        networkBanner.querySelector(".network-status-copy").textContent = "数据连接已恢复，可继续同步最新信息。";
        window.setTimeout(() => {
          networkBanner.hidden = true;
          networkBanner.classList.remove("success");
          networkBanner.querySelector(".network-status-title").textContent = "当前网络不可用";
          networkBanner.querySelector(".network-status-copy").textContent = "你仍可查看已缓存页面，联网后数据会继续同步。";
        }, 2200);
      } else {
        networkBanner.classList.remove("success");
        networkBanner.querySelector(".network-status-title").textContent = "当前网络不可用";
        networkBanner.querySelector(".network-status-copy").textContent = "你仍可查看已缓存页面，联网后数据会继续同步。";
      }
    };

    window.addEventListener("online", updateNetworkBanner);
    window.addEventListener("offline", updateNetworkBanner);
  }

  window.addEventListener("load", () => {
    navigator.serviceWorker.register("./technician-sw.js").catch(() => {});
  });

  const isStandalone = window.matchMedia("(display-mode: standalone)").matches || window.navigator.standalone === true;
  if (isStandalone) return;

  if (!mainPanel || document.getElementById("technician-pwa-banner")) return;

  let deferredPrompt = null;
  const banner = document.createElement("section");
  banner.className = "pwa-install-banner";
  banner.id = "technician-pwa-banner";
  banner.hidden = true;
  banner.innerHTML = `
    <div>
      <div class="pwa-install-title">添加到主屏幕</div>
      <div class="pwa-install-copy">将技师端保存到手机桌面，打开更快，使用更像原生应用。</div>
    </div>
    <div class="pwa-install-actions">
      <button class="ghost-button" id="technician-pwa-dismiss">稍后再说</button>
      <button class="pill-button" id="technician-pwa-install">立即添加</button>
    </div>
  `;
  mainPanel.insertBefore(banner, mainPanel.firstChild);

  const dismissButton = document.getElementById("technician-pwa-dismiss");
  const installButton = document.getElementById("technician-pwa-install");
  const dismissedKey = "zubao:technician-pwa-dismissed";

  if (!window.localStorage.getItem(dismissedKey)) {
    banner.hidden = false;
  }

  dismissButton?.addEventListener("click", () => {
    window.localStorage.setItem(dismissedKey, "1");
    banner.hidden = true;
  });

  installButton?.addEventListener("click", async () => {
    if (deferredPrompt) {
      deferredPrompt.prompt();
      const choice = await deferredPrompt.userChoice.catch(() => null);
      if (choice?.outcome === "accepted") {
        banner.hidden = true;
      }
      deferredPrompt = null;
      return;
    }
    alert("如果当前浏览器未弹出安装提示，请使用浏览器菜单中的“添加到主屏幕”完成安装。");
  });

  window.addEventListener("beforeinstallprompt", (event) => {
    event.preventDefault();
    deferredPrompt = event;
    banner.hidden = false;
  });

  window.addEventListener("appinstalled", () => {
    banner.hidden = true;
    window.localStorage.removeItem(dismissedKey);
  });
}

function initTechnicianChrome() {
  const page = document.body.dataset.page || "";
  if (!page.startsWith("technician-")) return;

  const mainPanel = document.querySelector(".main-panel");
  let actionBanner = document.getElementById("technician-action-banner");
  if (mainPanel && !actionBanner) {
    actionBanner = document.createElement("section");
    actionBanner.className = "network-status-banner success";
    actionBanner.id = "technician-action-banner";
    actionBanner.hidden = true;
    actionBanner.innerHTML = `
      <div class="network-status-title">已为你定位到相关内容</div>
      <div class="network-status-copy">你可以继续查看当前页面的重点信息。</div>
    `;
    mainPanel.insertBefore(actionBanner, mainPanel.firstChild);
  }

  const showActionBanner = (title, copy) => {
    if (!actionBanner) return;
    actionBanner.hidden = false;
    actionBanner.classList.add("success");
    actionBanner.querySelector(".network-status-title").textContent = title;
    actionBanner.querySelector(".network-status-copy").textContent = copy;
    window.clearTimeout(showActionBanner._timer);
    showActionBanner._timer = window.setTimeout(() => {
      actionBanner.hidden = true;
    }, 2200);
  };

  document.getElementById("technician-topbar-settings")?.addEventListener("click", () => {
    if (page === "technician-profile") {
      document.getElementById("technician-profile-name-input")?.scrollIntoView({ behavior: "smooth", block: "center" });
      document.getElementById("technician-profile-name-input")?.focus();
      showActionBanner("已打开资料编辑区域", "你可以直接修改姓名、简介和擅长项目。");
      return;
    }
    location.href = "./technician-profile.html";
  });

  document.getElementById("technician-topbar-notice")?.addEventListener("click", () => {
    const targetId = page === "technician-home"
      ? "technician-home-recent-orders"
      : page === "technician-earnings"
        ? "technician-earnings-records"
        : "technician-membership-history";
    const target = document.getElementById(targetId);
    if (target) {
      target.scrollIntoView({ behavior: "smooth", block: "start" });
      showActionBanner("已定位到最近动态", "这里展示了当前页面最需要关注的记录信息。");
    }
  });
}

async function handleLogin(role) {
  const phoneInput = document.getElementById(`${role}-phone`);
  const passwordInput = document.getElementById(`${role}-password`);
  const feedback = document.getElementById("login-feedback");
  if (feedback) {
    feedback.hidden = true;
    feedback.textContent = "";
  }

  try {
    const data = await apiRequest("/auth/login", {
      method: "POST",
      body: {
        phone: phoneInput.value.trim(),
        password: passwordInput.value
      }
    });

    const session = {
      token: data.token,
      user: data.user,
      membership: data.membership,
      shopId: data.membership?.shop_id || DEFAULT_SHOP_ID,
      technicianUserId: data.user?.role === "technician" ? data.user.id : null
    };

    setSession(session);

    if (role === "merchant") {
      location.href = "./merchant-dashboard.html";
      return;
    }

    location.href = "./technician-home.html";
  } catch (error) {
    if (feedback) {
      feedback.hidden = false;
      feedback.textContent = error.message;
    }
    alert(error.message);
  }
}

function initLoginPage() {
  const existingSession = getSession();
  const sessionBanner = document.getElementById("session-banner");
  if (existingSession?.token && sessionBanner) {
    sessionBanner.hidden = false;
    document.getElementById("session-banner-text").textContent = `当前已登录${existingSession.user?.role === "merchant" ? "商家端" : "技师端"}账号，可继续进入或退出后切换账号。`;
    document.getElementById("session-continue-button")?.addEventListener("click", () => {
      location.href = getHomePathByRole(existingSession.user?.role);
    });
    document.getElementById("session-logout-button")?.addEventListener("click", () => {
      clearSession();
      sessionBanner.hidden = true;
    });
  }

  document.getElementById("merchant-login-button")?.addEventListener("click", () => handleLogin("merchant"));
  document.getElementById("technician-login-button")?.addEventListener("click", () => handleLogin("technician"));
}

async function initMerchantDashboard() {
  const session = ensureMerchantSession();
  const data = await apiRequest(`/merchant/dashboard?shopId=${session.shopId}`, {
    headers: {
      "x-shop-id": session.shopId,
      "x-user-id": session.user.id
    }
  });

  document.querySelectorAll("[data-shop-name]").forEach((element) => {
    element.textContent = data.shop?.name || "足宝旗舰店";
  });
  const backstageName = document.querySelector("[data-shop-backstage-name]");
  if (backstageName) backstageName.textContent = `${data.shop?.name || "足宝旗舰店"}后台`;
  document.getElementById("dashboard-welcome-copy").textContent = `欢迎回来，${data.shop?.name || "门店"}今日运行良好。`;
  document.getElementById("dashboard-today-order-count").textContent = String(data.today?.today_order_count || 0);
  document.getElementById("dashboard-today-revenue").textContent = formatCurrency(data.today?.today_revenue || 0);
  document.getElementById("dashboard-on-duty-count").textContent = `${data.waitingTechnicians?.length || 0} / ${Math.max(data.waitingTechnicians?.length || 0, data.technicianRanking?.length || 0)}`;
  document.getElementById("dashboard-month-revenue").textContent = formatCurrency(data.monthSummary?.month_revenue || 0);
  document.getElementById("dashboard-profit-note").textContent = `完成订单 ${data.monthSummary?.completed_order_count || 0} 单 · 待钟技师 ${data.waitingTechnicians?.length || 0} 人`;
  document.getElementById("dashboard-completed-order-count").textContent = `${data.monthSummary?.completed_order_count || 0} 单`;
  document.getElementById("dashboard-in-service-count").textContent = `${data.today?.in_service_count || 0} 单进行中`;

  const ongoingOrders = document.getElementById("dashboard-ongoing-orders");
  if (data.ongoingOrders?.length) {
    ongoingOrders.innerHTML = data.ongoingOrders.map((order, index) => `
      <article class="dashboard-live-card ${order.status !== "in_service" ? "warning" : ""}">
        <div class="dashboard-live-index">${String(index + 1).padStart(2, "0")}</div>
        <div>
          <div class="dashboard-live-title">${order.service_name || "服务项目"} ${order.order_no}</div>
          <div class="small">客户：${order.customer_name || "到店客户"}　技师：${order.technician_name}</div>
        </div>
        <span class="badge ${order.status === "in_service" ? "success" : "warning"}">${order.status === "in_service" ? "服务中" : "待处理"}</span>
        <div class="dashboard-live-time">
          <div class="small">开始时间</div>
          <strong>${formatDateTime(order.start_time)}</strong>
        </div>
      </article>
    `).join("");
  } else {
    renderFallback(ongoingOrders, "当前没有进行中的订单。");
  }

  const waitingTechnicians = document.getElementById("dashboard-waiting-technicians");
  if (data.waitingTechnicians?.length) {
    waitingTechnicians.innerHTML = data.waitingTechnicians.map((technician) => `
      <div class="dashboard-standby-card">
        <div class="portrait dashboard-portrait"><div class="portrait-fallback">${getInitial(technician.name)}</div></div>
        <div class="dashboard-standby-body">
          <div style="font-weight: 800">${technician.name}</div>
          <div class="small">当前可立即安排</div>
        </div>
        <span class="badge success">待钟</span>
      </div>
    `).join("");
  } else {
    renderFallback(waitingTechnicians, "当前没有待钟技师。");
  }

  const rankingGrid = document.getElementById("dashboard-ranking-grid");
  if (data.technicianRanking?.length) {
    rankingGrid.innerHTML = data.technicianRanking.map((technician, index) => `
      <article class="dashboard-ranking-card leaderboard-card rank-${index + 1}">
        <div class="dashboard-ranking-topline">
          <div class="portrait dashboard-ranking-portrait"><div class="portrait-fallback">${getInitial(technician.name)}</div></div>
          <span class="dashboard-ranking-number">${String(index + 1).padStart(2, "0")}</span>
        </div>
        <div class="dashboard-ranking-body">
          <h3>${technician.name}</h3>
          <p class="small">本月服务表现</p>
          <div class="dashboard-ranking-stats">
            <div class="dashboard-ranking-stat">
              <span>上钟次数</span>
              <strong>${technician.completed_order_count} 次</strong>
            </div>
            <div class="dashboard-ranking-stat">
              <span>贡献营收</span>
              <strong>${formatCurrency(technician.contributed_revenue)}</strong>
            </div>
          </div>
        </div>
      </article>
    `).join("");
  } else {
    renderFallback(rankingGrid, "暂无技师排行数据。");
  }
}

async function initMerchantTechnicians() {
  const session = ensureMerchantSession();
  const headers = {
    "x-shop-id": session.shopId,
    "x-user-id": session.user.id
  };
  const [technicianData, applicationData] = await Promise.all([
    apiRequest(`/merchant/technicians?shopId=${session.shopId}`, { headers }),
    apiRequest(`/merchant/technician-applications?shopId=${session.shopId}`, { headers })
  ]);

  const technicians = technicianData.technicians || [];
  document.getElementById("technician-total-count").textContent = String(technicians.length);
  document.getElementById("technician-on-duty-count").textContent = String(technicians.filter((item) => item.attendance_status === "on_duty").length);
  document.getElementById("technician-available-count").textContent = String(technicians.filter((item) => item.service_status === "available").length).padStart(2, "0");
  const avgExp = technicians.length ? (technicians.reduce((sum, item) => sum + Number(item.years_experience || 0), 0) / technicians.length).toFixed(1) : "0.0";
  document.getElementById("technician-avg-exp").textContent = avgExp;

  const grid = document.getElementById("technician-grid");
  const detailPanel = document.getElementById("technician-detail-panel");
  const detailInfo = document.getElementById("technician-detail-info");
  const detailPerformance = document.getElementById("technician-detail-performance");
  let currentFilter = "all";

  function renderDetail(technician) {
    if (!detailPanel || !detailInfo || !detailPerformance) return;
    detailPanel.hidden = false;
    detailInfo.innerHTML = [
      ["技师姓名", technician.name],
      ["工号", technician.technician_user_id.slice(0, 8)],
      ["当前状态", technician.service_status === "available" ? "待钟" : "服务中"],
      ["出勤状态", technician.attendance_status === "on_duty" ? "在岗" : technician.attendance_status === "resting" ? "休息" : "离岗"]
    ].map(([label, value]) => `
      <div class="record-row" style="grid-template-columns: 120px 1fr">
        <div class="small">${label}</div>
        <div>${value}</div>
      </div>
    `).join("");
    detailPerformance.innerHTML = [
      ["从业年限", `${technician.years_experience} 年`],
      ["本月上钟", `${technician.completed_order_count} 次`],
      ["本月营收", formatCurrency(technician.month_revenue)],
      ["擅长项目", (technician.specialties || []).join(" / ") || "未填写"]
    ].map(([label, value]) => `
      <div class="record-row" style="grid-template-columns: 120px 1fr">
        <div class="small">${label}</div>
        <div>${value}</div>
      </div>
    `).join("");
    detailPanel.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  function renderTechnicians(filter = "all") {
    currentFilter = filter;
    document.querySelectorAll("[data-technician-filter]").forEach((button) => {
      button.className = button.dataset.technicianFilter === filter ? "pill-button" : "ghost-button";
    });

    const filteredTechnicians = technicians.filter((technician) => {
      if (filter === "all") return true;
      return technician.service_status === filter;
    });

    grid.innerHTML = filteredTechnicians.map((technician) => `
    <article class="technician-card media">
      <div class="portrait large"><div class="portrait-fallback">${getInitial(technician.name)}</div></div>
      <div class="technician-card-body">
        <div class="technician-card-top">
          <div>
            <div class="technician-card-name">${technician.name}</div>
            <div class="small">${technician.technician_user_id.slice(0, 8)}</div>
          </div>
          <span class="badge ${technician.service_status === "available" ? "success" : "warning"}">${technician.service_status === "available" ? "待钟" : "服务中"}</span>
        </div>
        <div class="technician-card-score">
          <span style="color: var(--accent)">在店 ${technician.years_experience} 年</span>
          <span class="small">本月上钟 ${technician.completed_order_count} 次</span>
        </div>
        <div class="technician-card-meta">
          ${(technician.specialties || []).map((tag) => `<span class="badge neutral">${tag}</span>`).join("")}
        </div>
        <div class="technician-card-revenue">本月营收 ${formatCurrency(technician.month_revenue)}</div>
        <div class="technician-card-actions">
          <button class="ghost-button" data-update-status="${technician.technician_user_id}" data-next-attendance="on_duty" data-next-service="${technician.service_status === "available" ? "in_service" : "available"}">修改状态</button>
          <button class="ghost-button" data-technician-detail="${technician.technician_user_id}">查看详情</button>
        </div>
      </div>
    </article>
  `).join("");

    grid.querySelectorAll("[data-update-status]").forEach((button) => {
      button.addEventListener("click", async () => {
        const serviceStatus = button.dataset.nextService;
        await apiRequest(`/merchant/technicians/${button.dataset.updateStatus}/status?shopId=${session.shopId}`, {
          method: "PATCH",
          headers,
          body: {
            attendanceStatus: "on_duty",
            serviceStatus
          }
        });
        location.reload();
      });
    });

    grid.querySelectorAll("[data-technician-detail]").forEach((button) => {
      button.addEventListener("click", () => {
        const technician = technicians.find((item) => item.technician_user_id === button.dataset.technicianDetail);
        if (technician) {
          renderDetail(technician);
        }
      });
    });

    if (!filteredTechnicians.length) {
      renderFallback(grid, "当前筛选条件下没有匹配的技师。");
    }
  }

  document.querySelectorAll("[data-technician-filter]").forEach((button) => {
    button.addEventListener("click", () => {
      renderTechnicians(button.dataset.technicianFilter);
    });
  });

  document.getElementById("technician-detail-close")?.addEventListener("click", () => {
    if (detailPanel) detailPanel.hidden = true;
  });

  renderTechnicians(currentFilter);

  const applications = applicationData.applications || [];
  document.getElementById("application-title").textContent = `待处理申请 (${applications.filter((item) => item.status === "pending").length})`;
  const applicationList = document.getElementById("application-list");
  if (applications.length) {
    applicationList.innerHTML = applications.map((application) => `
      <article class="application-row" style="grid-template-columns: 1fr auto auto">
        <div>
          <div style="font-weight: 800">${application.name}</div>
          <div class="small">申请加入 · ${(application.specialties || []).join(" / ") || "技师申请"}</div>
        </div>
        <button class="ghost-button" data-reject-application="${application.id}">拒绝申请</button>
        <button class="pill-button" data-approve-application="${application.id}">通过申请</button>
      </article>
    `).join("");
  } else {
    renderFallback(applicationList, "当前没有待处理申请。");
  }

  applicationList.querySelectorAll("[data-approve-application]").forEach((button) => {
    button.addEventListener("click", async () => {
      await apiRequest(`/merchant/technician-applications/${button.dataset.approveApplication}/approve?shopId=${session.shopId}`, {
        method: "POST",
        headers
      });
      location.reload();
    });
  });

  applicationList.querySelectorAll("[data-reject-application]").forEach((button) => {
    button.addEventListener("click", async () => {
      await apiRequest(`/merchant/technician-applications/${button.dataset.rejectApplication}/reject?shopId=${session.shopId}`, {
        method: "POST",
        headers,
        body: {
          reviewNote: "门店当前暂未开放名额"
        }
      });
      location.reload();
    });
  });
}

async function initMerchantOrders() {
  const session = ensureMerchantSession();
  const headers = {
    "x-shop-id": session.shopId,
    "x-user-id": session.user.id
  };
  const [orderData, optionData] = await Promise.all([
    apiRequest(`/merchant/orders?shopId=${session.shopId}`, { headers }),
    apiRequest(`/merchant/order-options?shopId=${session.shopId}`, { headers })
  ]);
  const allOrders = orderData.orders || [];
  const technicians = optionData.technicians || [];
  const serviceItems = optionData.serviceItems || [];
  const rooms = optionData.rooms || [];
  const customers = optionData.customers || [];
  const activeServiceItems = serviceItems.filter((item) => item.is_active);
  const activeRooms = rooms.filter((item) => item.is_active);
  const activeCustomers = customers.filter((item) => item.is_active);
  const searchInput = document.getElementById("orders-search-input");
  const dateInput = document.getElementById("orders-date-input");
  const statusFilters = document.querySelectorAll("[data-order-status-filter]");
  const createPanel = document.getElementById("orders-create-panel");
  const createToggle = document.getElementById("orders-create-toggle");
  const createToggleSidebar = document.getElementById("orders-create-toggle-sidebar");
  const createCancel = document.getElementById("orders-create-cancel");
  const createSubmit = document.getElementById("orders-create-submit");
  const editPanel = document.getElementById("orders-edit-panel");
  const editCancel = document.getElementById("orders-edit-cancel");
  const editSubmit = document.getElementById("orders-edit-submit");
  const editOrderNo = document.getElementById("orders-edit-order-no");
  const editSummary = document.getElementById("orders-edit-summary");
  const detailPanel = document.getElementById("orders-detail-panel");
  const detailItems = document.getElementById("orders-detail-items");
  const detailClose = document.getElementById("orders-detail-close");
  const detailPrev = document.getElementById("orders-detail-prev");
  const detailNext = document.getElementById("orders-detail-next");
  const technicianSelect = document.getElementById("orders-create-technician");
  const serviceItemSelect = document.getElementById("orders-create-service-item");
  const roomSelect = document.getElementById("orders-create-room");
  const customerSelect = document.getElementById("orders-create-customer");
  const startTimeInput = document.getElementById("orders-create-start-time");
  const noteInput = document.getElementById("orders-create-note");
  const createSummary = document.getElementById("orders-create-service-summary");
  const editTechnicianSelect = document.getElementById("orders-edit-technician");
  const editServiceItemSelect = document.getElementById("orders-edit-service-item");
  const editRoomSelect = document.getElementById("orders-edit-room");
  const editCustomerSelect = document.getElementById("orders-edit-customer");
  const editStartTimeInput = document.getElementById("orders-edit-start-time");
  const editNoteInput = document.getElementById("orders-edit-note");
  const editServiceSummary = document.getElementById("orders-edit-service-summary");
  let currentStatusFilter = "all";
  let editingOrderId = null;
  let detailOrderId = null;

  if (dateInput) dateInput.value = new Date().toISOString().slice(0, 10);
  if (startTimeInput) startTimeInput.value = toDateTimeLocalValue(new Date());

  function getOrderStatusMeta(status) {
    if (status === "completed") return { label: "已完成", badge: "neutral", card: "" };
    if (status === "cancelled") return { label: "已取消", badge: "neutral", card: "" };
    return { label: "服务中", badge: "warning", card: "warning" };
  }

  function buildTechnicianOptions(select, selectedValue = "") {
    if (!select) return;
    select.innerHTML = technicians.map((technician) => `
      <option value="${technician.technician_user_id}" ${technician.technician_user_id === selectedValue ? "selected" : ""}>
        ${technician.name} · ${technician.service_status === "available" ? "待钟" : technician.service_status === "in_service" ? "服务中" : "休息中"}
      </option>
    `).join("");
  }

  function buildServiceItemOptions(select, selectedValue = "") {
    if (!select) return;
    if (!activeServiceItems.length) {
      select.innerHTML = `<option value="">请先在基础资料中创建项目</option>`;
      return;
    }
    select.innerHTML = activeServiceItems.map((item) => `
      <option value="${item.id}" ${item.id === selectedValue ? "selected" : ""}>
        ${item.name} · ${formatCurrency(item.list_price)} · ${item.duration_minutes} 分钟
      </option>
    `).join("");
  }

  function buildRoomOptions(select, selectedValue = "") {
    if (!select) return;
    if (!activeRooms.length) {
      select.innerHTML = `<option value="">请先在基础资料中创建房间</option>`;
      return;
    }
    select.innerHTML = activeRooms.map((room) => `
      <option value="${room.id}" ${room.id === selectedValue ? "selected" : ""}>
        ${room.name}${room.room_type ? ` · ${room.room_type}` : ""}
      </option>
    `).join("");
  }

  function buildCustomerOptions(select, selectedValue = "walk-in") {
    if (!select) return;
    select.innerHTML = [
      `<option value="walk-in" ${selectedValue === "walk-in" ? "selected" : ""}>散客</option>`,
      ...activeCustomers.map((customer) => `
        <option value="${customer.id}" ${customer.id === selectedValue ? "selected" : ""}>
          ${customer.name}${customer.phone ? ` · ${customer.phone}` : ""}${customer.is_member ? " · 会员" : ""}
        </option>
      `)
    ].join("");
  }

  function renderServiceSummary(container, serviceItemId) {
    if (!container) return;
    const serviceItem = activeServiceItems.find((item) => item.id === serviceItemId);
    if (!serviceItem) {
      container.innerHTML = `
        <div class="record-row" style="grid-template-columns: 120px 1fr">
          <div class="small">项目说明</div>
          <div>请选择项目后自动带出</div>
        </div>
      `;
      return;
    }

    container.innerHTML = [
      ["项目名称", serviceItem.name],
      ["项目内容", serviceItem.description || "暂无项目内容"],
      ["订单类型", serviceItem.service_mode === "designated" ? "点钟" : "排钟"],
      ["项目价格", formatCurrency(serviceItem.list_price)],
      ["服务时长", `${serviceItem.duration_minutes} 分钟`]
    ].map(([label, value]) => `
      <div class="record-row" style="grid-template-columns: 120px 1fr">
        <div class="small">${label}</div>
        <div>${value}</div>
      </div>
    `).join("");
  }

  function getFilteredOrders() {
    const keyword = (searchInput?.value || "").trim().toLowerCase();
    const selectedDate = dateInput?.value || "";
    return allOrders.filter((order) => {
      const matchedKeyword = !keyword || [order.order_no, order.technician_name, order.customer_name, order.room_code, order.service_name].filter(Boolean).join(" ").toLowerCase().includes(keyword);
      const matchedDate = !selectedDate || order.start_time?.slice(0, 10) === selectedDate;
      const matchedStatus = currentStatusFilter === "all" || order.status === currentStatusFilter;
      return matchedKeyword && matchedDate && matchedStatus;
    });
  }

  function closeEditPanel() {
    editingOrderId = null;
    if (editPanel) editPanel.hidden = true;
    if (editOrderNo) editOrderNo.textContent = "--";
    if (editSummary) {
      editSummary.innerHTML = `
        <div class="record-row" style="grid-template-columns: 120px 1fr">
          <div class="small">技师</div>
          <div>--</div>
        </div>
      `;
    }
    buildTechnicianOptions(editTechnicianSelect);
    buildServiceItemOptions(editServiceItemSelect);
    buildRoomOptions(editRoomSelect);
    buildCustomerOptions(editCustomerSelect);
    if (editStartTimeInput) editStartTimeInput.value = "";
    if (editNoteInput) editNoteInput.value = "";
    renderServiceSummary(editServiceSummary, "");
    showFieldFeedback("orders-edit-feedback", "");
  }

  function closeDetailPanel() {
    detailOrderId = null;
    if (detailPanel) detailPanel.hidden = true;
    if (detailItems) {
      detailItems.innerHTML = `
        <div class="record-row" style="grid-template-columns: 120px 1fr">
          <div class="small">订单号</div>
          <div>--</div>
        </div>
      `;
    }
  }

  function openEditPanel(order) {
    editingOrderId = order.id;
    closeDetailPanel();
    if (createPanel) createPanel.hidden = true;
    if (editPanel) editPanel.hidden = false;
    if (editOrderNo) editOrderNo.textContent = order.order_no || "--";
    if (editSummary) {
      editSummary.innerHTML = [
        ["技师", order.technician_name || "--"],
        ["订单状态", getOrderStatusMeta(order.status).label],
        ["订单金额", formatCurrency(order.actual_amount)],
        ["开始时间", order.start_time ? formatDateTime(order.start_time) : "--"]
      ].map(([label, value]) => `
        <div class="record-row" style="grid-template-columns: 120px 1fr">
          <div class="small">${label}</div>
          <div>${value}</div>
        </div>
      `).join("");
    }
    buildTechnicianOptions(editTechnicianSelect, order.technician_user_id);
    buildServiceItemOptions(editServiceItemSelect, order.service_item_id);
    buildRoomOptions(editRoomSelect, order.room_id);
    buildCustomerOptions(editCustomerSelect, order.customer_id || "walk-in");
    if (editStartTimeInput) editStartTimeInput.value = order.start_time ? toDateTimeLocalValue(order.start_time) : "";
    if (editNoteInput) editNoteInput.value = order.note || "";
    renderServiceSummary(editServiceSummary, order.service_item_id);
    showFieldFeedback("orders-edit-feedback", "");
    editTechnicianSelect?.focus();
    editPanel?.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  function openDetailPanel(order) {
    detailOrderId = order.id;
    if (createPanel) createPanel.hidden = true;
    closeEditPanel();
    if (detailPanel) detailPanel.hidden = false;
    if (detailItems) {
      detailItems.innerHTML = [
        ["订单号", order.order_no || "--"],
        ["服务项目", order.service_name || "服务项目"],
        ["项目内容", order.service_description || "暂无项目内容"],
        ["技师", order.technician_name || "--"],
        ["订单类型", order.order_type === "designated" ? "点钟" : "排钟"],
        ["订单状态", getOrderStatusMeta(order.status).label],
        ["客户", order.customer_type === "registered" ? (order.customer_name || "--") : "散客"],
        ["房间", order.room_name || order.room_code || "--"],
        ["开始时间", order.start_time ? formatDateTime(order.start_time) : "--"],
        ["结束时间", order.end_time ? formatDateTime(order.end_time) : "进行中"],
        ["服务金额", formatCurrency(order.service_amount)],
        ["实收金额", formatCurrency(order.actual_amount)],
        ["备注", order.note || "暂无备注"]
      ].map(([label, value]) => `
        <div class="record-row" style="grid-template-columns: 120px 1fr">
          <div class="small">${label}</div>
          <div>${value}</div>
        </div>
      `).join("");
    }
    const filteredOrders = getFilteredOrders();
    const currentIndex = filteredOrders.findIndex((item) => item.id === order.id);
    if (detailPrev) detailPrev.disabled = currentIndex <= 0;
    if (detailNext) detailNext.disabled = currentIndex === -1 || currentIndex >= filteredOrders.length - 1;
    detailPanel?.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  function renderOrders() {
    const filtered = getFilteredOrders();

    statusFilters.forEach((button) => {
      button.className = button.dataset.orderStatusFilter === currentStatusFilter ? "pill-button" : "ghost-button";
    });

    document.getElementById("orders-total-count").textContent = String(filtered.length);
    document.getElementById("orders-total-revenue").textContent = formatCurrency(filtered.reduce((sum, order) => sum + Number(order.actual_amount || 0), 0));
    document.getElementById("orders-pending-count").textContent = String(filtered.filter((order) => order.status !== "completed").length);

    const list = document.getElementById("orders-list");
    if (!filtered.length) {
      renderFallback(list, "没有匹配的订单记录。");
    } else {
      list.innerHTML = filtered.map((order, index) => `
        <article class="dashboard-live-card ${getOrderStatusMeta(order.status).card}">
          <div class="dashboard-live-index">${String(index + 1).padStart(2, "0")}</div>
          <div>
            <div class="dashboard-live-title">${order.order_no} ${order.service_name || "服务项目"}</div>
            <div class="small">客户：${order.customer_type === "registered" ? order.customer_name : "散客"}　技师：${order.technician_name}　房间：${order.room_name || order.room_code || "--"}</div>
          </div>
          <span class="badge ${getOrderStatusMeta(order.status).badge}">${getOrderStatusMeta(order.status).label}</span>
          <div class="dashboard-live-time">
            <div class="small">订单金额</div>
            <strong>${formatCurrency(order.actual_amount)}</strong>
          </div>
          <div class="inline-group">
            <button class="ghost-button" data-order-view="${order.id}">查看详情</button>
            <button class="ghost-button" data-order-edit="${order.id}">编辑订单</button>
            ${order.status === "in_service" ? `
              <button class="ghost-button" data-order-complete="${order.id}">完成订单</button>
              <button class="ghost-button" data-order-cancel="${order.id}">取消订单</button>
            ` : ""}
          </div>
        </article>
      `).join("");

      list.querySelectorAll("[data-order-view]").forEach((button) => {
        button.addEventListener("click", () => {
          const target = allOrders.find((item) => item.id === button.dataset.orderView);
          if (target) openDetailPanel(target);
        });
      });

      list.querySelectorAll("[data-order-edit]").forEach((button) => {
        button.addEventListener("click", () => {
          const target = allOrders.find((item) => item.id === button.dataset.orderEdit);
          if (target) openEditPanel(target);
        });
      });

      list.querySelectorAll("[data-order-complete]").forEach((button) => {
        button.addEventListener("click", async () => {
          try {
            const response = await apiRequest(`/merchant/orders/${button.dataset.orderComplete}/complete?shopId=${session.shopId}`, {
              method: "PATCH",
              headers
            });
            const target = allOrders.find((item) => item.id === button.dataset.orderComplete);
            if (target) Object.assign(target, response.order || {});
            renderOrders();
          } catch (error) {
            alert(error.message);
          }
        });
      });

      list.querySelectorAll("[data-order-cancel]").forEach((button) => {
        button.addEventListener("click", async () => {
          try {
            const response = await apiRequest(`/merchant/orders/${button.dataset.orderCancel}/cancel?shopId=${session.shopId}`, {
              method: "PATCH",
              headers
            });
            const target = allOrders.find((item) => item.id === button.dataset.orderCancel);
            if (target) Object.assign(target, response.order || {});
            renderOrders();
          } catch (error) {
            alert(error.message);
          }
        });
      });
    }

    const statusList = document.getElementById("orders-status-list");
    statusList.innerHTML = [
      ["服务中", filtered.filter((order) => order.status === "in_service").length],
      ["已完成", filtered.filter((order) => order.status === "completed").length],
      ["已取消", filtered.filter((order) => order.status === "cancelled").length]
    ].map(([label, count]) => `
      <div class="dashboard-status-row">
        <span>${label}</span>
        <strong>${count} 单</strong>
      </div>
    `).join("");
  }

  buildTechnicianOptions(technicianSelect);
  buildTechnicianOptions(editTechnicianSelect);
  buildServiceItemOptions(serviceItemSelect);
  buildServiceItemOptions(editServiceItemSelect);
  buildRoomOptions(roomSelect);
  buildRoomOptions(editRoomSelect);
  buildCustomerOptions(customerSelect);
  buildCustomerOptions(editCustomerSelect);
  renderServiceSummary(createSummary, serviceItemSelect?.value);
  renderServiceSummary(editServiceSummary, editServiceItemSelect?.value);

  serviceItemSelect?.addEventListener("change", () => renderServiceSummary(createSummary, serviceItemSelect.value));
  editServiceItemSelect?.addEventListener("change", () => renderServiceSummary(editServiceSummary, editServiceItemSelect.value));
  searchInput?.addEventListener("input", renderOrders);
  dateInput?.addEventListener("change", renderOrders);
  statusFilters.forEach((button) => {
    button.addEventListener("click", () => {
      currentStatusFilter = button.dataset.orderStatusFilter;
      renderOrders();
    });
  });

  function openCreatePanel() {
    closeEditPanel();
    closeDetailPanel();
    if (createPanel) createPanel.hidden = false;
    showFieldFeedback("orders-create-feedback", "");
    if (!technicians.length || !activeServiceItems.length || !activeRooms.length) {
      showFieldFeedback("orders-create-feedback", "请先完善技师、项目和房间资料后再开单。", true);
    }
  }

  createToggle?.addEventListener("click", openCreatePanel);
  createToggleSidebar?.addEventListener("click", openCreatePanel);
  const searchParams = new URLSearchParams(window.location.search);
  if (searchParams.get("openCreate") === "1") {
    openCreatePanel();
  }
  createCancel?.addEventListener("click", () => {
    if (createPanel) createPanel.hidden = true;
    showFieldFeedback("orders-create-feedback", "");
  });
  editCancel?.addEventListener("click", closeEditPanel);
  detailClose?.addEventListener("click", closeDetailPanel);
  detailPrev?.addEventListener("click", () => {
    if (!detailOrderId) return;
    const filteredOrders = getFilteredOrders();
    const currentIndex = filteredOrders.findIndex((item) => item.id === detailOrderId);
    if (currentIndex > 0) openDetailPanel(filteredOrders[currentIndex - 1]);
  });
  detailNext?.addEventListener("click", () => {
    if (!detailOrderId) return;
    const filteredOrders = getFilteredOrders();
    const currentIndex = filteredOrders.findIndex((item) => item.id === detailOrderId);
    if (currentIndex !== -1 && currentIndex < filteredOrders.length - 1) openDetailPanel(filteredOrders[currentIndex + 1]);
  });
  createSubmit?.addEventListener("click", async () => {
    try {
      showFieldFeedback("orders-create-feedback", "");
      const customerValue = customerSelect?.value || "walk-in";
      const response = await apiRequest(`/merchant/orders?shopId=${session.shopId}`, {
        method: "POST",
        headers,
        body: {
          technicianUserId: technicianSelect?.value,
          serviceItemId: serviceItemSelect?.value,
          roomId: roomSelect?.value,
          customerId: customerValue !== "walk-in" ? customerValue : null,
          customerType: customerValue !== "walk-in" ? "registered" : "walk_in",
          startTime: startTimeInput?.value ? new Date(startTimeInput.value).toISOString() : new Date().toISOString(),
          note: noteInput?.value.trim()
        }
      });
      allOrders.unshift(response.order);
      if (createPanel) createPanel.hidden = true;
      buildCustomerOptions(customerSelect);
      if (noteInput) noteInput.value = "";
      if (startTimeInput) startTimeInput.value = toDateTimeLocalValue(new Date());
      renderServiceSummary(createSummary, serviceItemSelect?.value);
      renderOrders();
    } catch (error) {
      showFieldFeedback("orders-create-feedback", error.message, true);
    }
  });
  editSubmit?.addEventListener("click", async () => {
    if (!editingOrderId) return;
    try {
      showFieldFeedback("orders-edit-feedback", "");
      const customerValue = editCustomerSelect?.value || "walk-in";
      const response = await apiRequest(`/merchant/orders/${editingOrderId}?shopId=${session.shopId}`, {
        method: "PATCH",
        headers,
        body: {
          technicianUserId: editTechnicianSelect?.value,
          serviceItemId: editServiceItemSelect?.value,
          roomId: editRoomSelect?.value,
          customerId: customerValue !== "walk-in" ? customerValue : null,
          customerType: customerValue !== "walk-in" ? "registered" : "walk_in",
          startTime: editStartTimeInput?.value ? new Date(editStartTimeInput.value).toISOString() : null,
          note: editNoteInput?.value.trim()
        }
      });
      const target = allOrders.find((item) => item.id === editingOrderId);
      if (target) Object.assign(target, response.order || {});
      closeEditPanel();
      renderOrders();
    } catch (error) {
      showFieldFeedback("orders-edit-feedback", error.message, true);
    }
  });
  renderOrders();
}

async function initMerchantPayroll() {
  const session = ensureMerchantSession();
  const headers = {
    "x-shop-id": session.shopId,
    "x-user-id": session.user.id
  };
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
    ["点钟提成比例", "点钟订单服务金额 × 提成比例", `${Number(rule.designated_commission_rate || 0) * 100}%`],
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
        throw new Error("当前工资周期不存在，暂时无法重算。");
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

async function initMerchantMasterData() {
  const session = ensureMerchantSession();
  const headers = {
    "x-shop-id": session.shopId,
    "x-user-id": session.user.id
  };
  const [serviceItemData, roomData, customerData] = await Promise.all([
    apiRequest(`/merchant/service-items?shopId=${session.shopId}`, { headers }),
    apiRequest(`/merchant/rooms?shopId=${session.shopId}`, { headers }),
    apiRequest(`/merchant/customers?shopId=${session.shopId}`, { headers })
  ]);

  const serviceItems = serviceItemData.serviceItems || [];
  const rooms = roomData.rooms || [];
  const customers = customerData.customers || [];
  let editingServiceItemId = null;
  let editingRoomId = null;
  let editingCustomerId = null;

  const serviceNameInput = document.getElementById("service-item-name-input");
  const serviceDescriptionInput = document.getElementById("service-item-description-input");
  const serviceModeInput = document.getElementById("service-item-mode-input");
  const servicePriceInput = document.getElementById("service-item-price-input");
  const serviceDurationInput = document.getElementById("service-item-duration-input");
  const roomNameInput = document.getElementById("room-name-input");
  const roomTypeInput = document.getElementById("room-type-input");
  const roomNoteInput = document.getElementById("room-note-input");
  const customerNameInput = document.getElementById("customer-name-input");
  const customerPhoneInput = document.getElementById("customer-phone-input");
  const customerGenderInput = document.getElementById("customer-gender-input");
  const customerMemberInput = document.getElementById("customer-member-input");
  const customerNoteInput = document.getElementById("customer-note-input");

  bindAmountInputNormalization(servicePriceInput);

  function resetServiceItemForm() {
    editingServiceItemId = null;
    if (serviceNameInput) serviceNameInput.value = "";
    if (serviceDescriptionInput) serviceDescriptionInput.value = "";
    if (serviceModeInput) serviceModeInput.value = "scheduled";
    if (servicePriceInput) servicePriceInput.value = "";
    if (serviceDurationInput) serviceDurationInput.value = "";
    showFieldFeedback("service-item-feedback", "");
  }

  function resetRoomForm() {
    editingRoomId = null;
    if (roomNameInput) roomNameInput.value = "";
    if (roomTypeInput) roomTypeInput.value = "";
    if (roomNoteInput) roomNoteInput.value = "";
    showFieldFeedback("room-feedback", "");
  }

  function resetCustomerForm() {
    editingCustomerId = null;
    if (customerNameInput) customerNameInput.value = "";
    if (customerPhoneInput) customerPhoneInput.value = "";
    if (customerGenderInput) customerGenderInput.value = "";
    if (customerMemberInput) customerMemberInput.value = "false";
    if (customerNoteInput) customerNoteInput.value = "";
    showFieldFeedback("customer-feedback", "");
  }

  function renderServiceItems() {
    const list = document.getElementById("service-item-list");
    if (!serviceItems.length) {
      renderFallback(list, "当前还没有项目，请先创建第一个服务项目。");
      return;
    }
    list.innerHTML = serviceItems.map((item) => `
      <div class="record-row" style="grid-template-columns: minmax(0,1fr) auto auto">
        <div>
          <div style="font-weight: 800">${item.name}</div>
          <div class="small">${item.service_mode === "designated" ? "点钟" : "排钟"} · ${formatCurrency(item.list_price)} · ${item.duration_minutes} 分钟</div>
          <div class="small">${item.description || "暂无项目内容"}</div>
        </div>
        <button class="ghost-button" data-edit-service-item="${item.id}">编辑</button>
        <button class="${item.is_active ? "ghost-button" : "pill-button"}" data-toggle-service-item="${item.id}">
          ${item.is_active ? "停用" : "启用"}
        </button>
      </div>
    `).join("");

    list.querySelectorAll("[data-edit-service-item]").forEach((button) => {
      button.addEventListener("click", () => {
        const item = serviceItems.find((entry) => entry.id === button.dataset.editServiceItem);
        if (!item) return;
        editingServiceItemId = item.id;
        serviceNameInput.value = item.name || "";
        serviceDescriptionInput.value = item.description || "";
        serviceModeInput.value = item.service_mode || "scheduled";
        servicePriceInput.value = formatAmountInputValue(item.list_price || 0);
        serviceDurationInput.value = String(Number(item.duration_minutes || 0));
        serviceNameInput.focus();
      });
    });

    list.querySelectorAll("[data-toggle-service-item]").forEach((button) => {
      button.addEventListener("click", async () => {
        try {
          const item = serviceItems.find((entry) => entry.id === button.dataset.toggleServiceItem);
          const response = await apiRequest(`/merchant/service-items/${button.dataset.toggleServiceItem}?shopId=${session.shopId}`, {
            method: "PATCH",
            headers,
            body: {
              isActive: !item?.is_active
            }
          });
          const target = serviceItems.find((entry) => entry.id === button.dataset.toggleServiceItem);
          if (target) Object.assign(target, response.serviceItem || {});
          renderServiceItems();
        } catch (error) {
          showFieldFeedback("service-item-feedback", error.message, true);
        }
      });
    });
  }

  function renderRooms() {
    const list = document.getElementById("room-list");
    if (!rooms.length) {
      renderFallback(list, "当前还没有房间，请先创建房间。");
      return;
    }
    list.innerHTML = rooms.map((room) => `
      <div class="record-row" style="grid-template-columns: minmax(0,1fr) auto auto">
        <div>
          <div style="font-weight: 800">${room.name}</div>
          <div class="small">${room.room_type || "未设置房间类型"}</div>
          <div class="small">${room.note || "暂无备注"}</div>
        </div>
        <button class="ghost-button" data-edit-room="${room.id}">编辑</button>
        <button class="${room.is_active ? "ghost-button" : "pill-button"}" data-toggle-room="${room.id}">
          ${room.is_active ? "停用" : "启用"}
        </button>
      </div>
    `).join("");

    list.querySelectorAll("[data-edit-room]").forEach((button) => {
      button.addEventListener("click", () => {
        const room = rooms.find((entry) => entry.id === button.dataset.editRoom);
        if (!room) return;
        editingRoomId = room.id;
        roomNameInput.value = room.name || "";
        roomTypeInput.value = room.room_type || "";
        roomNoteInput.value = room.note || "";
        roomNameInput.focus();
      });
    });

    list.querySelectorAll("[data-toggle-room]").forEach((button) => {
      button.addEventListener("click", async () => {
        try {
          const room = rooms.find((entry) => entry.id === button.dataset.toggleRoom);
          const response = await apiRequest(`/merchant/rooms/${button.dataset.toggleRoom}?shopId=${session.shopId}`, {
            method: "PATCH",
            headers,
            body: {
              isActive: !room?.is_active
            }
          });
          const target = rooms.find((entry) => entry.id === button.dataset.toggleRoom);
          if (target) Object.assign(target, response.room || {});
          renderRooms();
        } catch (error) {
          showFieldFeedback("room-feedback", error.message, true);
        }
      });
    });
  }

  function renderCustomers() {
    const list = document.getElementById("customer-list");
    if (!customers.length) {
      renderFallback(list, "当前还没有客户档案，散客会在开单时默认处理。");
      return;
    }
    list.innerHTML = customers.map((customer) => `
      <div class="record-row" style="grid-template-columns: minmax(0,1fr) auto auto">
        <div>
          <div style="font-weight: 800">${customer.name}</div>
          <div class="small">${customer.phone || "未留电话"}${customer.gender ? ` · ${customer.gender === "male" ? "男" : "女"}` : ""}${customer.is_member ? " · 会员客户" : " · 普通档案"}</div>
          <div class="small">${customer.note || "暂无客户备注"}${customer.last_visit_at ? ` · 最近到店 ${formatDateTime(customer.last_visit_at)}` : ""}</div>
        </div>
        <button class="ghost-button" data-edit-customer="${customer.id}">编辑</button>
        <button class="${customer.is_active ? "ghost-button" : "pill-button"}" data-toggle-customer="${customer.id}">
          ${customer.is_active ? "停用" : "启用"}
        </button>
      </div>
    `).join("");

    list.querySelectorAll("[data-edit-customer]").forEach((button) => {
      button.addEventListener("click", () => {
        const customer = customers.find((entry) => entry.id === button.dataset.editCustomer);
        if (!customer) return;
        editingCustomerId = customer.id;
        customerNameInput.value = customer.name || "";
        customerPhoneInput.value = customer.phone || "";
        customerGenderInput.value = customer.gender || "";
        customerMemberInput.value = customer.is_member ? "true" : "false";
        customerNoteInput.value = customer.note || "";
        customerNameInput.focus();
      });
    });

    list.querySelectorAll("[data-toggle-customer]").forEach((button) => {
      button.addEventListener("click", async () => {
        try {
          const customer = customers.find((entry) => entry.id === button.dataset.toggleCustomer);
          const response = await apiRequest(`/merchant/customers/${button.dataset.toggleCustomer}?shopId=${session.shopId}`, {
            method: "PATCH",
            headers,
            body: {
              isActive: !customer?.is_active
            }
          });
          const target = customers.find((entry) => entry.id === button.dataset.toggleCustomer);
          if (target) Object.assign(target, response.customer || {});
          renderCustomers();
        } catch (error) {
          showFieldFeedback("customer-feedback", error.message, true);
        }
      });
    });
  }

  document.getElementById("service-item-reset-button")?.addEventListener("click", resetServiceItemForm);
  document.getElementById("room-reset-button")?.addEventListener("click", resetRoomForm);
  document.getElementById("customer-reset-button")?.addEventListener("click", resetCustomerForm);

  document.getElementById("service-item-save-button")?.addEventListener("click", async () => {
    try {
      showFieldFeedback("service-item-feedback", "");
      const body = {
        name: serviceNameInput?.value.trim(),
        description: serviceDescriptionInput?.value.trim(),
        serviceMode: serviceModeInput?.value,
        listPrice: parseAmountInputValue(servicePriceInput?.value),
        durationMinutes: Number(serviceDurationInput?.value || 0)
      };
      const response = editingServiceItemId
        ? await apiRequest(`/merchant/service-items/${editingServiceItemId}?shopId=${session.shopId}`, { method: "PATCH", headers, body })
        : await apiRequest(`/merchant/service-items?shopId=${session.shopId}`, { method: "POST", headers, body });
      if (editingServiceItemId) {
        const target = serviceItems.find((entry) => entry.id === editingServiceItemId);
        if (target) Object.assign(target, response.serviceItem || {});
      } else if (response.serviceItem) {
        serviceItems.unshift(response.serviceItem);
      }
      resetServiceItemForm();
      renderServiceItems();
      showFieldFeedback("service-item-feedback", "项目资料已保存。");
    } catch (error) {
      showFieldFeedback("service-item-feedback", error.message, true);
    }
  });

  document.getElementById("room-save-button")?.addEventListener("click", async () => {
    try {
      showFieldFeedback("room-feedback", "");
      const body = {
        name: roomNameInput?.value.trim(),
        roomType: roomTypeInput?.value.trim(),
        note: roomNoteInput?.value.trim()
      };
      const response = editingRoomId
        ? await apiRequest(`/merchant/rooms/${editingRoomId}?shopId=${session.shopId}`, { method: "PATCH", headers, body })
        : await apiRequest(`/merchant/rooms?shopId=${session.shopId}`, { method: "POST", headers, body });
      if (editingRoomId) {
        const target = rooms.find((entry) => entry.id === editingRoomId);
        if (target) Object.assign(target, response.room || {});
      } else if (response.room) {
        rooms.unshift(response.room);
      }
      resetRoomForm();
      renderRooms();
      showFieldFeedback("room-feedback", "房间资料已保存。");
    } catch (error) {
      showFieldFeedback("room-feedback", error.message, true);
    }
  });

  document.getElementById("customer-save-button")?.addEventListener("click", async () => {
    try {
      showFieldFeedback("customer-feedback", "");
      const body = {
        name: customerNameInput?.value.trim(),
        phone: customerPhoneInput?.value.trim(),
        gender: customerGenderInput?.value || null,
        isMember: customerMemberInput?.value === "true",
        note: customerNoteInput?.value.trim()
      };
      const response = editingCustomerId
        ? await apiRequest(`/merchant/customers/${editingCustomerId}?shopId=${session.shopId}`, { method: "PATCH", headers, body })
        : await apiRequest(`/merchant/customers?shopId=${session.shopId}`, { method: "POST", headers, body });
      if (editingCustomerId) {
        const target = customers.find((entry) => entry.id === editingCustomerId);
        if (target) Object.assign(target, response.customer || {});
      } else if (response.customer) {
        customers.unshift(response.customer);
      }
      resetCustomerForm();
      renderCustomers();
      showFieldFeedback("customer-feedback", "客户档案已保存。");
    } catch (error) {
      showFieldFeedback("customer-feedback", error.message, true);
    }
  });

  renderServiceItems();
  renderRooms();
  renderCustomers();
}

async function initMerchantSettings() {
  const session = ensureMerchantSession();
  const headers = {
    "x-shop-id": session.shopId,
    "x-user-id": session.user.id
  };
  const data = await apiRequest(`/merchant/settings?shopId=${session.shopId}`, { headers });
  const info = data.shop || {};

  const infoContainer = document.getElementById("settings-shop-info");
  const renderInfo = (shop) => {
    infoContainer.innerHTML = [
      ["店铺名称", shop.name || "--"],
      ["负责人", shop.manager_name || "--"],
      ["联系电话", shop.contact_phone || "--"],
      ["门店地址", shop.address || "--"]
    ].map(([label, value]) => `
      <div class="record-row" style="grid-template-columns: 120px 1fr">
        <div class="small">${label}</div>
        <div>${value}</div>
      </div>
    `).join("");
  };

  renderInfo(info);
  const nameInput = document.getElementById("settings-shop-name-input");
  const managerInput = document.getElementById("settings-manager-name-input");
  const phoneInput = document.getElementById("settings-contact-phone-input");
  const addressInput = document.getElementById("settings-address-input");
  const qrInput = document.getElementById("settings-qr-code-input");
  if (nameInput) nameInput.value = info.name || "";
  if (managerInput) managerInput.value = info.manager_name || "";
  if (phoneInput) phoneInput.value = info.contact_phone || "";
  if (addressInput) addressInput.value = info.address || "";
  if (qrInput) qrInput.value = info.qr_code_url || "";

  document.getElementById("settings-save-button")?.addEventListener("click", async () => {
    try {
      showFieldFeedback("settings-feedback", "");
      const result = await apiRequest(`/merchant/settings?shopId=${session.shopId}`, {
        method: "PUT",
        headers,
        body: {
          name: nameInput?.value.trim(),
          managerName: managerInput?.value.trim(),
          contactPhone: phoneInput?.value.trim(),
          address: addressInput?.value.trim(),
          qrCodeUrl: qrInput?.value.trim()
        }
      });
      renderInfo(result.shop || {});
      showFieldFeedback("settings-feedback", "门店设置已保存。");
    } catch (error) {
      showFieldFeedback("settings-feedback", error.message, true);
    }
  });
}

async function initMerchantAnalytics() {
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
    const data = await apiRequest(`/merchant/analytics?shopId=${session.shopId}&period=${period}`, { headers });
    document.querySelectorAll("[data-analytics-period]").forEach((button) => {
      button.className = button.dataset.analyticsPeriod === period ? "pill-button" : "ghost-button";
    });
    document.getElementById("analytics-page-copy").textContent = `当前查看${periodLabels[period]}经营表现，统计周期 ${data.periodLabel}。`;
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

async function initTechnicianHome() {
  const session = ensureTechnicianSession();
  const technicianId = session.technicianUserId || session.user.id;
  const data = await apiRequest(`/technician/home?technicianUserId=${technicianId}`);
  const latestStatus = data.latestStatus || {};
  const statusTextMap = {
    available: "待钟",
    in_service: "服务中",
    resting: "休息中"
  };
  const currentStatusText = latestStatus.attendance_status === "off_duty"
    ? "下班"
    : statusTextMap[latestStatus.service_status] || "待钟";

  document.getElementById("technician-home-name").textContent = data.profile?.name || "技师";
  document.getElementById("technician-home-id").textContent = `工号 ${String(data.profile?.technician_user_id || technicianId).slice(0, 8)}`;
  document.getElementById("technician-home-specialties").innerHTML = (data.profile?.specialties || []).map((tag) => `<span class="badge success">${tag}</span>`).join("");
  const membershipStatus = data.membership?.membership_status === "active" ? "已签约" : "未签约";
  document.getElementById("technician-home-copy").textContent = `当前门店 ${data.membership?.shop_name || "--"}　状态 ${membershipStatus}`;
  document.getElementById("technician-home-status").textContent = currentStatusText;
  document.getElementById("technician-home-income").textContent = formatCurrency(data.monthSummary?.month_revenue || 0);
  document.getElementById("technician-home-service-count").textContent = `${data.monthSummary?.completed_order_count || 0} 次`;
  document.getElementById("technician-home-exp").textContent = `${data.profile?.years_experience || 0} 年`;

  document.getElementById("technician-home-membership-list").innerHTML = `
    <div class="menu-item">
      <div class="menu-meta">
        <div class="icon-pill"><span class="material-symbols-outlined">storefront</span></div>
        <div>
          <div style="font-weight: 700">当前门店</div>
          <div class="small">${data.membership?.shop_name || "未加入门店"}</div>
        </div>
      </div>
      <span class="badge ${data.membership?.membership_status === "active" ? "success" : "warning"}">${data.membership?.membership_status === "active" ? "已加入门店" : "未签约"}</span>
    </div>
    <div class="menu-item">
      <div class="menu-meta">
        <div class="icon-pill"><span class="material-symbols-outlined">schedule</span></div>
        <div>
          <div style="font-weight: 700">本月状态</div>
          <div class="small">本月完成 ${data.monthSummary?.completed_order_count || 0} 单，收入 ${formatCurrency(data.monthSummary?.month_revenue || 0)}</div>
        </div>
      </div>
      <span class="badge success">${currentStatusText}</span>
    </div>
    <div class="menu-item">
      <div class="menu-meta">
        <div class="icon-pill"><span class="material-symbols-outlined">link</span></div>
        <div>
          <div style="font-weight: 700">门店关系</div>
          <div class="small">已签约门店期间不可申请其它门店，解约后恢复申请资格。</div>
        </div>
      </div>
      <a class="action-link" href="./technician-profile.html">查看详情 <span class="material-symbols-outlined">arrow_forward</span></a>
    </div>
  `;

  const recentOrders = document.getElementById("technician-home-recent-orders");
  if (!data.recentOrders?.length) {
    renderFallback(recentOrders, "暂无最近结算记录。");
  } else {
    recentOrders.innerHTML = data.recentOrders.map((order) => `
      <div class="menu-item">
        <div class="menu-meta">
          <div class="icon-pill"><span class="material-symbols-outlined">payments</span></div>
          <div>
            <div style="font-weight: 700">${order.order_no}</div>
            <div class="small">${order.order_type === "designated" ? "点钟订单" : "排钟订单"} · ${formatDateTime(order.start_time)}</div>
          </div>
        </div>
        <span class="badge success">${formatCurrency(order.actual_amount)}</span>
      </div>
    `).join("");
  }

  const toggleButton = document.getElementById("technician-toggle-status");
  const toggleCopy = document.getElementById("technician-toggle-status-copy");
  if (toggleButton) {
    let nextAttendanceStatus = "on_duty";
    let nextServiceStatus = "available";
    let nextButtonLabel = "开始上班";
    let nextCopy = "当前未在岗，点击后切换为可接单状态。";

    if (latestStatus.attendance_status === "on_duty" && latestStatus.service_status === "available") {
      nextAttendanceStatus = "resting";
      nextServiceStatus = "resting";
      nextButtonLabel = "切换休息";
      nextCopy = "当前为待钟状态，可切换为休息中。";
    } else if (latestStatus.attendance_status === "resting" || latestStatus.service_status === "resting") {
      nextAttendanceStatus = "on_duty";
      nextServiceStatus = "available";
      nextButtonLabel = "恢复接单";
      nextCopy = "当前处于休息中，点击后恢复待钟。";
    } else if (latestStatus.service_status === "in_service") {
      nextButtonLabel = "服务进行中";
      nextCopy = "服务中状态由订单流转控制，当前不可手动切换。";
      toggleButton.disabled = true;
      toggleButton.style.opacity = "0.6";
      toggleButton.style.cursor = "not-allowed";
    } else if (latestStatus.attendance_status === "off_duty") {
      nextAttendanceStatus = "on_duty";
      nextServiceStatus = "available";
      nextButtonLabel = "开始上班";
      nextCopy = "当前未在岗，点击后切换为可接单状态。";
    }

    toggleButton.textContent = nextButtonLabel;
    if (toggleCopy) toggleCopy.textContent = nextCopy;

    if (!toggleButton.disabled) {
      toggleButton.addEventListener("click", async () => {
        try {
          await apiRequest(`/technician/status?technicianUserId=${technicianId}`, {
            method: "POST",
            body: {
              attendanceStatus: nextAttendanceStatus,
              serviceStatus: nextServiceStatus
            }
          });
          location.reload();
        } catch (error) {
          alert(error.message);
        }
      });
    }
  }
}

async function initTechnicianEarnings() {
  const session = ensureTechnicianSession();
  const technicianId = session.technicianUserId || session.user.id;
  const [profileData, earningsData] = await Promise.all([
    apiRequest(`/technician/profile?technicianUserId=${technicianId}`),
    apiRequest(`/technician/earnings?technicianUserId=${technicianId}`)
  ]);

  const earnings = earningsData.earnings || [];
  const totalAmount = earnings.reduce((sum, item) => sum + Number(item.gross_salary_amount || 0), 0);
  const totalOrders = earnings.reduce((sum, item) => sum + Number(item.completed_order_count || 0), 0);
  const paidCount = earnings.filter((item) => item.payment_status === "paid").length;

  document.getElementById("technician-earnings-total").textContent = formatCurrency(totalAmount);
  document.getElementById("technician-earnings-name").textContent = profileData.profile?.name || "技师";
  document.getElementById("technician-earnings-count").textContent = `${totalOrders} 笔服务`;
  document.getElementById("technician-earnings-service-count").textContent = String(totalOrders);
  document.getElementById("technician-earnings-paid-count").textContent = `${paidCount} 期`;

  const trend = earningsData.trend || [];
  const maxTrendRevenue = Math.max(...trend.map((item) => Number(item.revenue || 0)), 1);
  const highestTrendIndex = trend.reduce((bestIndex, item, index, list) => {
    const current = Number(item.revenue || 0);
    const best = Number(list[bestIndex]?.revenue || 0);
    return current > best ? index : bestIndex;
  }, 0);
  const trendChart = document.getElementById("technician-earnings-trend-chart");
  if (trendChart) {
    trendChart.innerHTML = trend.map((item, index) => `
      <div class="bar-group">
        <div class="bar ${index === highestTrendIndex ? "active" : ""}" style="height: ${Math.max(12, Math.round((Number(item.revenue || 0) / maxTrendRevenue) * 100))}%"></div>
        <span class="bar-label" style="${index === highestTrendIndex ? "color: var(--accent)" : ""}">${item.weekday_label}</span>
      </div>
    `).join("");
  }

  const records = document.getElementById("technician-earnings-records");
  if (!earnings.length) {
    renderFallback(records, "暂无收益记录。");
  } else {
    records.innerHTML = earnings.map((item) => `
      <div class="record-row">
        <div class="inline-group">
          <div class="icon-pill"><span class="material-symbols-outlined">payments</span></div>
          <div>
            <div style="font-weight: 700">${formatMonth(item.cycle_month.slice(0, 7))}</div>
            <div class="small">${item.completed_order_count} 笔服务 · 底薪 ${formatCurrency(item.base_salary_amount)}</div>
          </div>
        </div>
        <div style="text-align: right">
          <div style="font-weight: 800">${formatCurrency(item.gross_salary_amount)}</div>
          <div class="small" style="color: var(--success)">${item.payment_status === "paid" ? "已结算" : "待发放"}</div>
        </div>
      </div>
    `).join("");
  }
}

async function initTechnicianProfile() {
  const session = ensureTechnicianSession();
  const technicianId = session.technicianUserId || session.user.id;
  const [profileData, membershipData] = await Promise.all([
    apiRequest(`/technician/profile?technicianUserId=${technicianId}`),
    apiRequest(`/technician/membership?technicianUserId=${technicianId}`)
  ]);

  const profile = profileData.profile || {};
  const membership = membershipData.currentMembership || null;
  const applicationHistory = membershipData.applicationHistory || [];
  const avatarElement = document.getElementById("technician-profile-avatar");
  const avatarInput = document.getElementById("technician-profile-avatar-input");
  const avatarButton = document.getElementById("technician-profile-avatar-button");
  const avatarResetButton = document.getElementById("technician-profile-avatar-reset");
  const editShortcutButton = document.getElementById("technician-profile-edit-shortcut");
  const avatarStorageKey = `zubao:avatar-preview:${technicianId}`;
  let currentAvatarUrl = window.localStorage.getItem(avatarStorageKey) || profile.avatar_url || "";
  let avatarCleared = false;

  function renderAvatarPreview(name, imageUrl = "") {
    if (!avatarElement) return;
    if (imageUrl) {
      avatarElement.innerHTML = `<img src="${imageUrl}" alt="${name || "技师头像"}" style="width: 100%; height: 100%; object-fit: cover;" />`;
      avatarElement.classList.remove("avatar-fallback");
      return;
    }
    avatarElement.textContent = getInitial(name || "技");
    avatarElement.classList.add("avatar-fallback");
  }

  renderAvatarPreview(profile.name || "技师", currentAvatarUrl);
  document.getElementById("technician-profile-name").textContent = profile.name || "技师";
  document.getElementById("technician-profile-id").textContent = `工号 ${String(profile.technician_user_id || technicianId).slice(0, 8)}`;
  document.getElementById("technician-profile-bio").textContent = profile.bio || "暂无个人简介。";
  document.getElementById("technician-profile-specialties").innerHTML = (profile.specialties || []).map((tag) => `<span class="badge success">${tag}</span>`).join("");
  const nameInput = document.getElementById("technician-profile-name-input");
  const yearsInput = document.getElementById("technician-profile-years-input");
  const specialtiesInput = document.getElementById("technician-profile-specialties-input");
  const bioInput = document.getElementById("technician-profile-bio-input");
  if (nameInput) nameInput.value = profile.name || "";
  if (yearsInput) yearsInput.value = String(Number(profile.years_experience || 0));
  if (specialtiesInput) specialtiesInput.value = (profile.specialties || []).join("，");
  if (bioInput) bioInput.value = profile.bio || "";
  document.getElementById("technician-profile-badges").innerHTML = `
    <span class="badge success">${membership?.shop_name || "未加入门店"}</span>
    <span class="badge ${membership?.membership_status === "active" ? "success" : "warning"}">${membership?.membership_status === "active" ? "在岗" : "未签约"}</span>
  `;

  document.getElementById("technician-profile-info").innerHTML = [
    ["姓名", profile.name || "--"],
    ["手机号", session.user.phone || "--"],
    ["从业年限", `${profile.years_experience || 0} 年`],
    ["当前门店", membership?.shop_name || "--"]
  ].map(([label, value]) => `
    <div class="record-row" style="grid-template-columns: 120px 1fr">
      <div class="small">${label}</div>
      <div>${value}</div>
    </div>
  `).join("");

  document.getElementById("technician-membership-info").innerHTML = `
    <div class="menu-item">
      <div class="menu-meta">
        <div class="icon-pill"><span class="material-symbols-outlined">storefront</span></div>
        <div>
          <div style="font-weight: 700">当前签约门店</div>
          <div class="small">${membership?.shop_name || "暂未签约"} · ${membership?.membership_status === "active" ? "已签约" : "未签约"}</div>
        </div>
      </div>
      <span class="badge ${membership?.membership_status === "active" ? "success" : "warning"}">${membership?.membership_status === "active" ? "当前签约中" : "可申请"}</span>
    </div>
    <div class="menu-item">
      <div class="menu-meta">
        <div class="icon-pill"><span class="material-symbols-outlined">lock</span></div>
        <div>
          <div style="font-weight: 700">申请权限状态</div>
          <div class="small">${membership?.membership_status === "active" ? "签约期间不可申请其它门店，需先解约。" : "当前可重新申请加入门店。"}</div>
        </div>
      </div>
      <span class="badge ${membership?.membership_status === "active" ? "warning" : "neutral"}">${membership?.membership_status === "active" ? "已锁定" : "可申请"}</span>
    </div>
  `;

  const history = document.getElementById("technician-membership-history");
  if (!applicationHistory.length) {
    renderFallback(history, "暂无门店记录。");
  } else {
    history.innerHTML = applicationHistory.map((item) => `
      <div class="record-row" style="grid-template-columns: 1fr auto">
        <div>
          <div style="font-weight: 800">${item.shop_name}</div>
          <div class="small">${formatDateTime(item.applied_at)} 申请记录</div>
        </div>
        <span class="badge ${item.status === "approved" ? "success" : item.status === "pending" ? "warning" : "neutral"}">${item.status === "approved" ? "已通过" : item.status === "pending" ? "审核中" : "未通过"}</span>
      </div>
    `).join("");
  }

  const saveProfile = async () => {
    try {
      showFieldFeedback("technician-profile-feedback", "");
      const nextProfile = await apiRequest(`/technician/profile?technicianUserId=${technicianId}`, {
        method: "PUT",
        body: {
          name: nameInput?.value.trim(),
          avatarUrl: avatarCleared ? null : currentAvatarUrl || null,
          clearAvatar: avatarCleared,
          yearsExperience: Number(yearsInput?.value || 0),
          specialties: (specialtiesInput?.value || "").split(/[，,]/).map((item) => item.trim()).filter(Boolean),
          bio: bioInput?.value.trim()
        }
      });
      currentAvatarUrl = nextProfile.profile?.avatar_url || "";
      avatarCleared = false;
      if (currentAvatarUrl) {
        window.localStorage.setItem(avatarStorageKey, currentAvatarUrl);
      } else {
        window.localStorage.removeItem(avatarStorageKey);
      }
      renderAvatarPreview(nextProfile.profile?.name || "技师", currentAvatarUrl);
      document.getElementById("technician-profile-name").textContent = nextProfile.profile?.name || "技师";
      document.getElementById("technician-profile-bio").textContent = nextProfile.profile?.bio || "暂无个人简介。";
      document.getElementById("technician-profile-specialties").innerHTML = (nextProfile.profile?.specialties || []).map((tag) => `<span class="badge success">${tag}</span>`).join("");
      document.getElementById("technician-profile-info").innerHTML = [
        ["姓名", nextProfile.profile?.name || "--"],
        ["手机号", session.user.phone || "--"],
        ["从业年限", `${nextProfile.profile?.years_experience || 0} 年`],
        ["当前门店", membership?.shop_name || "--"]
      ].map(([label, value]) => `
        <div class="record-row" style="grid-template-columns: 120px 1fr">
          <div class="small">${label}</div>
          <div>${value}</div>
        </div>
      `).join("");
      showFieldFeedback("technician-profile-feedback", "个人资料已保存。");
    } catch (error) {
      showFieldFeedback("technician-profile-feedback", error.message, true);
    }
  };

  document.getElementById("technician-profile-edit-button")?.addEventListener("click", () => {
    nameInput?.focus();
    nameInput?.scrollIntoView({ behavior: "smooth", block: "center" });
  });
  editShortcutButton?.addEventListener("click", () => {
    nameInput?.focus();
    nameInput?.scrollIntoView({ behavior: "smooth", block: "center" });
  });
  avatarButton?.addEventListener("click", () => {
    avatarInput?.click();
  });
  avatarInput?.addEventListener("change", () => {
    const file = avatarInput.files?.[0];
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      showFieldFeedback("technician-profile-feedback", "请选择图片文件作为头像。", true);
      avatarInput.value = "";
      return;
    }
    if (file.size > 2 * 1024 * 1024) {
      showFieldFeedback("technician-profile-feedback", "头像图片请控制在 2MB 以内。", true);
      avatarInput.value = "";
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      const result = String(reader.result || "");
      currentAvatarUrl = result;
      avatarCleared = false;
      renderAvatarPreview(nameInput?.value.trim() || profile.name || "技师", result);
      window.localStorage.setItem(avatarStorageKey, result);
      showFieldFeedback("technician-profile-feedback", "头像预览已更新，点击保存后会同步到资料中。");
    };
    reader.onerror = () => {
      showFieldFeedback("technician-profile-feedback", "头像预览生成失败，请重新选择图片。", true);
    };
    reader.readAsDataURL(file);
  });
  avatarResetButton?.addEventListener("click", () => {
    currentAvatarUrl = "";
    avatarCleared = true;
    window.localStorage.removeItem(avatarStorageKey);
    if (avatarInput) avatarInput.value = "";
    renderAvatarPreview(nameInput?.value.trim() || profile.name || "技师");
    showFieldFeedback("technician-profile-feedback", "头像已恢复为默认展示，保存后将同步到资料。");
  });
  document.getElementById("technician-profile-save")?.addEventListener("click", saveProfile);
}

async function main() {
  bindRoleTabs();
  bindApplicationToggles();
  injectLogoutAction();
  initTechnicianPwa();
  initTechnicianChrome();

  const page = document.body.dataset.page;
  try {
    if (page === "login") await initLoginPage();
    if (page === "merchant-dashboard") await initMerchantDashboard();
    if (page === "merchant-technicians") await initMerchantTechnicians();
    if (page === "merchant-orders") await initMerchantOrders();
    if (page === "merchant-master-data") await initMerchantMasterData();
    if (page === "merchant-payroll") await initMerchantPayroll();
    if (page === "merchant-analytics") await initMerchantAnalytics();
    if (page === "merchant-settings") await initMerchantSettings();
    if (page === "technician-home") await initTechnicianHome();
    if (page === "technician-earnings") await initTechnicianEarnings();
    if (page === "technician-profile") await initTechnicianProfile();
  } catch (error) {
    if (!["Missing merchant session", "Missing technician session"].includes(error.message)) {
      console.error("[app-error]", error);
    }
  }
}

main();
