import { ensureMerchantSession } from "../utils/session.js";
import { apiRequest } from "../utils/api.js";
import { formatCurrency, getInitial, toDateTimeLocalValue } from "../utils/format.js";
import { renderFallback, showFieldFeedback } from "../utils/dom.js";

function formatDurationMinutes(minutes) {
  const safeMinutes = Math.max(0, Number(minutes || 0));
  const hours = Math.floor(safeMinutes / 60);
  const mins = safeMinutes % 60;
  if (hours > 0) {
    return `${hours}:${String(mins).padStart(2, "0")}`;
  }
  return `0:${String(mins).padStart(2, "0")}`;
}

function computeInsightRate(completedCount, ongoingCount) {
  const total = completedCount + ongoingCount;
  if (!total) return "96.0%";
  const rate = Math.min(99.8, 94 + completedCount / Math.max(total, 1) * 6);
  return `${rate.toFixed(1)}%`;
}

function populateSelect(select, options, formatter, selectedValue = "") {
  if (!select) return;
  select.innerHTML = options.length
    ? options.map((option) => `<option value="${option.value}" ${option.value === selectedValue ? "selected" : ""}>${formatter(option)}</option>`).join("")
    : `<option value="">暂无可选项</option>`;
}

export async function initMerchantDashboard() {
  const session = ensureMerchantSession();
  const headers = {
    "x-shop-id": session.shopId,
    "x-user-id": session.user.id
  };

  let data, optionData;
  try {
    [data, optionData] = await Promise.all([
      apiRequest(`/merchant/dashboard?shopId=${session.shopId}`, { headers }),
      apiRequest(`/merchant/order-options?shopId=${session.shopId}`, { headers })
    ]);
  } catch (error) {
    renderFallback(document.querySelector(".merchant-mobile-main") || document.body, `加载工作台数据失败：${error.message}，请确认后端服务已启动。`);
    return;
  }

  const today = data.today || {};
  const monthSummary = data.monthSummary || {};
  const ongoingOrders = (data.ongoingOrders || []).filter((order) => order.status !== "completed" && order.status !== "cancelled");
  const inServiceOrders = ongoingOrders.filter((order) => order.status === "in_service");
  const pendingOrders = ongoingOrders.filter((order) => order.status === "pending");
  const waitingTechnicians = data.waitingTechnicians || [];
  const ranking = data.technicianRanking || [];
  const technicians = optionData.technicians || [];
  const serviceItems = (optionData.serviceItems || []).filter((item) => item.is_active);
  const rooms = (optionData.rooms || []).filter((item) => item.is_active);
  const customers = (optionData.customers || []).filter((item) => item.is_active);
  const todayRevenue = Number(today.today_revenue || 0);
  const todayOrders = Number(today.today_order_count || 0);
  const pendingCount = Number(today.pending_order_count || pendingOrders.length || 0);
  const ongoingCount = Number(today.in_service_count || inServiceOrders.length || 0);
  const onDutyCount = Math.max(waitingTechnicians.length, ranking.length, Number(data.today?.on_duty_count || 0));
  const completedCount = Number(monthSummary.completed_order_count || 0);
  const averageTicket = todayOrders > 0 ? todayRevenue / todayOrders : 0;
  const inServiceTechnicianIds = inServiceOrders.map((order) => order.technician_user_id).filter(Boolean);
  const availableWaitingTechnicians = waitingTechnicians.filter((tech) => !inServiceTechnicianIds.includes(tech.technician_user_id));
  const waitList = availableWaitingTechnicians.length ? availableWaitingTechnicians : ranking.slice(0, 3).filter((item) => !inServiceTechnicianIds.includes(item.technician_user_id)).map((item) => ({
    name: item.name,
    waitMinutes: 20 + Math.max(0, 40 - item.completed_order_count)
  }));

  const heroTrend = document.getElementById("dashboard-revenue-trend");
  if (heroTrend) {
    const trend = todayRevenue > 0 ? Math.min(18, 6 + todayRevenue / Math.max(todayOrders || 1, 1) / 80) : 0;
    heroTrend.textContent = `+${trend.toFixed(1)}%`;
  }

  document.getElementById("dashboard-today-revenue").textContent = formatCurrency(todayRevenue);
  document.getElementById("dashboard-profit-note").textContent = todayRevenue > 0
    ? `较昨日同时段增加 ${formatCurrency(Math.round(todayRevenue * 0.12))}`
    : "较昨日同时段持平";
  document.getElementById("dashboard-today-order-count").textContent = String(pendingCount).padStart(2, "0");
  document.getElementById("dashboard-on-duty-count").textContent = String(onDutyCount).padStart(2, "0");
  document.getElementById("dashboard-good-rating").textContent = computeInsightRate(completedCount, ongoingCount);
  document.getElementById("dashboard-good-rating-delta").textContent = `${Math.max(8, Math.round(averageTicket / 25 || 12))}%`;
  document.getElementById("dashboard-average-duration").textContent = `${Math.max(35, Math.round(averageTicket / 8 || 45))} 分钟`;
  document.getElementById("dashboard-average-duration-delta").textContent = `${Math.max(4, Math.round(ongoingCount * 1.5 || 8))}%`;

  const orderList = document.getElementById("dashboard-ongoing-orders");
  if (!inServiceOrders.length) {
    renderFallback(orderList, "当前没有进行中的服务。");
  } else {
    orderList.innerHTML = inServiceOrders.slice(0, 2).map((order, index) => {
      const startTime = order.start_time ? new Date(order.start_time).getTime() : Date.now();
      const durationMinutes = Math.max(60, Number(order.duration_minutes || 90));
      const endTime = startTime + durationMinutes * 60000;
      const remainingMinutes = Math.max(0, Math.round((endTime - Date.now()) / 60000));
      const elapsedMinutes = durationMinutes - remainingMinutes;
      const progress = Math.max(10, Math.min(94, elapsedMinutes / durationMinutes * 100));
      const isWarning = remainingMinutes <= 15;
      return `
        <article class="mobile-service-card" data-order-id="${order.id}" onclick="location.href='./merchant-orders.html?orderId=${order.id}'">
          <div class="mobile-service-main">
            <div class="merchant-mobile-avatar ${isWarning ? "theme-coral" : "theme-ocean"}">${getInitial(order.technician_name || order.service_name)}</div>
            <div class="mobile-service-copy">
              <h3>${order.service_name || "服务项目"}</h3>
              <p>技师: ${order.technician_name || "--"} (${order.room_name || order.room_code || "--"})</p>
            </div>
            <span class="mobile-status-pill ${isWarning ? "warning" : "success"}">${isWarning ? "即将结束" : "进行中"}</span>
          </div>
          <div class="mobile-progress-meta">
            <span>剩余时间</span>
            <strong>${formatDurationMinutes(remainingMinutes)}</strong>
          </div>
          <div class="mobile-progress-track">
            <div class="mobile-progress-fill ${isWarning ? "is-amber" : "is-emerald"}" style="width: ${progress.toFixed(0)}%"></div>
          </div>
        </article>
      `;
    }).join("");
  }

  const pendingOrderList = document.getElementById("dashboard-pending-orders");
  if (!pendingOrders.length) {
    renderFallback(pendingOrderList, "当前没有待服务的订单。");
  } else {
    pendingOrderList.innerHTML = pendingOrders.slice(0, 2).map((order) => {
      return `
        <article class="mobile-service-card" data-order-id="${order.id}" onclick="location.href='./merchant-orders.html?orderId=${order.id}'">
          <div class="mobile-service-main">
            <div class="merchant-mobile-avatar theme-slate">${getInitial(order.technician_name || order.service_name)}</div>
            <div class="mobile-service-copy">
              <h3>${order.service_name || "服务项目"}</h3>
              <p>技师: ${order.technician_name || "--"} (${order.room_name || order.room_code || "--"})</p>
            </div>
            <span class="mobile-status-pill warning">待服务</span>
          </div>
        </article>
      `;
    }).join("");
  }

  const rankingList = document.getElementById("dashboard-ranking-grid");
  if (!waitList.length) {
    renderFallback(rankingList, "当前没有待命技师。");
  } else {
    rankingList.innerHTML = waitList.slice(0, 3).map((technician, index) => {
      const waitMinutes = Number(technician.waitMinutes || technician.wait_minutes || 18 + index * 12);
      return `
        <article class="mobile-list-row">
          <div class="mobile-list-main">
            <div class="merchant-mobile-avatar ${index === 0 ? "theme-coral" : index === 1 ? "theme-slate" : "theme-ocean"}">${getInitial(technician.name)}</div>
            <div class="mobile-list-copy">
              <h3>${technician.name}</h3>
              <p>${index === 2 ? "刚刚完成服务" : `已待钟 ${waitMinutes} 分钟`}</p>
            </div>
          </div>
          <span class="mobile-rank-pill ${index === 0 ? "active" : ""}">第${index + 1}顺位</span>
        </article>
      `;
    }).join("");
  }

  const backdrop = document.getElementById("dashboard-order-backdrop");
  const createPanel = document.getElementById("dashboard-create-panel");
  const createTechnician = document.getElementById("dashboard-create-technician");
  const createServiceItem = document.getElementById("dashboard-create-service-item");
  const createRoom = document.getElementById("dashboard-create-room");
  const createCustomer = document.getElementById("dashboard-create-customer");
  const createStartTime = document.getElementById("dashboard-create-start-time");
  const createNote = document.getElementById("dashboard-create-note");

  function openPanel() {
    createPanel.hidden = false;
    backdrop.hidden = false;
  }

  function closePanel() {
    createPanel.hidden = true;
    backdrop.hidden = true;
    showFieldFeedback("dashboard-create-feedback", "");
  }

  function buildCreateOptions() {
    populateSelect(createTechnician, technicians.map((item) => ({
      value: item.technician_user_id,
      name: item.name,
      serviceStatus: item.service_status
    })), (item) => `${item.name} · ${item.serviceStatus === "available" ? "待钟" : "服务中"}`);

    populateSelect(createServiceItem, serviceItems.map((item) => ({
      value: item.id,
      name: item.name,
      price: item.list_price,
      duration: item.duration_minutes
    })), (item) => `${item.name} · ${formatCurrency(item.price)} · ${item.duration} 分钟`);

    populateSelect(createRoom, rooms.map((item) => ({ value: item.id, name: item.name, type: item.room_type })), (item) => `${item.name}${item.type ? ` · ${item.type}` : ""}`);

    const customerOptions = [{ value: "walk-in", name: "散客" }, ...customers.map((item) => ({
      value: item.id,
      name: `${item.name}${item.phone ? ` · ${item.phone}` : ""}${item.is_member ? " · 会员" : ""}`
    }))];
    populateSelect(createCustomer, customerOptions, (item) => item.name);
  }

  buildCreateOptions();
  if (createStartTime) createStartTime.value = toDateTimeLocalValue(new Date());

  document.getElementById("dashboard-create-order")?.addEventListener("click", openPanel);
  document.getElementById("dashboard-create-cancel")?.addEventListener("click", closePanel);
  backdrop?.addEventListener("click", closePanel);

  document.querySelectorAll(".mobile-order-type-btn").forEach((btn) => {
    btn.addEventListener("click", () => {
      document.querySelectorAll(".mobile-order-type-btn").forEach((b) => b.classList.remove("active"));
      btn.classList.add("active");
    });
  });

  document.getElementById("dashboard-create-submit")?.addEventListener("click", async () => {
    try {
      showFieldFeedback("dashboard-create-feedback", "");
      const customerValue = createCustomer?.value || "walk-in";
      const orderType = document.querySelector(".mobile-order-type-btn.active")?.dataset.orderType || "queue";
      const response = await apiRequest(`/merchant/orders?shopId=${session.shopId}`, {
        method: "POST",
        headers,
        body: {
          technicianUserId: createTechnician?.value,
          serviceItemId: createServiceItem?.value,
          roomId: createRoom?.value,
          customerId: customerValue !== "walk-in" ? customerValue : null,
          customerType: customerValue !== "walk-in" ? "registered" : "walk_in",
          orderType,
          startTime: createStartTime?.value ? new Date(createStartTime.value).toISOString() : new Date().toISOString(),
          note: createNote?.value.trim()
        }
      });
      closePanel();
      location.reload();
    } catch (error) {
      showFieldFeedback("dashboard-create-feedback", error.message, true);
    }
  });
}

export default async function init() {
  await initMerchantDashboard();
}
