import { ensureMerchantSession } from "../utils/session.js";
import { apiRequest } from "../utils/api.js";
import {
  bindAmountInputNormalization,
  formatAmountInputValue,
  formatCurrency,
  formatDateTime,
  formatDateTimeRange,
  getInitial,
  parseAmountInputValue,
  toDateTimeLocalValue
} from "../utils/format.js";
import { showFieldFeedback, renderFallback } from "../utils/dom.js";

function toLocalDateStr(date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

function getOrderFilterKey(order) {
  if (order.status === "completed") return "completed";
  if (order.status === "cancelled") return "cancelled";
  if (order.status === "pending") return "pending";
  return "in_service";
}

function getOrderVisualMeta(order) {
  if (order.status === "completed") {
    return { label: "已完成", pill: "neutral", action: "查看订单" };
  }
  if (order.status === "cancelled") {
    return { label: "已取消", pill: "neutral", action: "查看订单" };
  }
  if (order.status === "pending") {
    return { label: "待服务", pill: "warning", action: "开始服务" };
  }
  return { label: "进行中", pill: "success", action: "管理/加钟" };
}

function getRemainingMinutes(order) {
  if (!order.start_time) {
    return Math.max(60, Number(order.duration_minutes || 90));
  }
  const startTime = new Date(order.start_time).getTime();
  const endTime = order.end_time ? new Date(order.end_time).getTime() : startTime + Math.max(60, Number(order.duration_minutes || 90)) * 60000;
  return Math.max(0, Math.round((endTime - Date.now()) / 60000));
}

function getOrderStatusLabel(order) {
  return getOrderVisualMeta(order).label;
}

function getOrderTypeLabel(order) {
  return order.order_type === "direct" || order.order_type === "designated" ? "点钟" : "排钟";
}

function renderRecords(container, rows) {
  if (!container) return;
  container.innerHTML = rows.map(([label, value]) => `
    <div class="record-row">
      <div class="small">${label}</div>
      <div>${value}</div>
    </div>
  `).join("");
}

function renderSelectOptions(options, selectedValue = "") {
  return options.length
    ? options.map((option) => `<option value="${option.value}" ${option.value === selectedValue ? "selected" : ""}>${option.label}</option>`).join("")
    : `<option value="">暂无可选项</option>`;
}

function getServiceItemAmountCents(serviceItems, serviceItemId) {
  const serviceItem = serviceItems.find((item) => item.id === serviceItemId);
  return Math.round(Number(serviceItem?.list_price || 0) * 100);
}

function formatDateLabel(dateStr) {
  if (!dateStr) return "今天";
  const todayStr = toLocalDateStr(new Date());
  const yesterday = new Date();
  yesterday.setDate(yesterday.getDate() - 1);
  const yesterdayStr = toLocalDateStr(yesterday);

  if (dateStr === todayStr) return "今天";
  if (dateStr === yesterdayStr) return "昨天";

  const parts = dateStr.split("-");
  const d = new Date(Number(parts[0]), Number(parts[1]) - 1, Number(parts[2]));
  const weekdays = ["周日", "周一", "周二", "周三", "周四", "周五", "周六"];
  return `${d.getMonth() + 1}月${d.getDate()}日 ${weekdays[d.getDay()]}`;
}

export async function initMerchantOrders() {
  const session = ensureMerchantSession();
  const headers = {
    "x-shop-id": session.shopId,
    "x-user-id": session.user.id
  };

  const optionData = await apiRequest(`/merchant/order-options?shopId=${session.shopId}`, { headers });
  const technicians = optionData.technicians || [];
  const serviceItems = (optionData.serviceItems || []).filter((item) => item.is_active);
  const rooms = (optionData.rooms || []).filter((item) => item.is_active);
  const customers = (optionData.customers || []).filter((item) => item.is_active);

  const backdrop = document.getElementById("orders-sheet-backdrop");
  const filterPanel = document.getElementById("orders-filter-panel");
  const createPanel = document.getElementById("orders-create-panel");
  const editPanel = document.getElementById("orders-edit-panel");
  const detailPanel = document.getElementById("orders-detail-panel");
  const settlePanel = document.getElementById("orders-settle-panel");
  const searchInput = document.getElementById("orders-search-input");
  const dateInput = document.getElementById("orders-date-input");
  const statusButtons = Array.from(document.querySelectorAll("[data-order-status-filter]"));

  const dateNavLabel = document.getElementById("orders-date-label");
  const datePicker = document.getElementById("orders-date-picker");
  const datePrevBtn = document.getElementById("orders-date-prev");
  const dateNextBtn = document.getElementById("orders-date-next");
  const heroLabel = document.getElementById("orders-hero-label");
  const loadMoreSection = document.getElementById("orders-load-more");
  const loadMoreBtn = document.getElementById("orders-load-more-btn");
  const loadMoreInfo = document.getElementById("orders-load-more-info");

  const createTechnician = document.getElementById("orders-create-technician");
  const createServiceItem = document.getElementById("orders-create-service-item");
  const createRoom = document.getElementById("orders-create-room");
  const createCustomer = document.getElementById("orders-create-customer");
  const createStartTime = document.getElementById("orders-create-start-time");
  const createNote = document.getElementById("orders-create-note");
  const createSummary = document.getElementById("orders-create-service-summary");

  const editTechnician = document.getElementById("orders-edit-technician");
  const editServiceItem = document.getElementById("orders-edit-service-item");
  const editRoom = document.getElementById("orders-edit-room");
  const editCustomer = document.getElementById("orders-edit-customer");
  const editStartTime = document.getElementById("orders-edit-start-time");
  const editEndTime = document.getElementById("orders-edit-end-time");
  const editServiceAmount = document.getElementById("orders-edit-service-amount");
  const editActualAmount = document.getElementById("orders-edit-actual-amount");
  const editNote = document.getElementById("orders-edit-note");
  const editServiceSummary = document.getElementById("orders-edit-service-summary");
  const editDeleteBtn = document.getElementById("orders-edit-delete");
  const editRecords = document.getElementById("orders-edit-records");
  const editTitle = document.getElementById("orders-edit-title");
  const editTechnicianField = document.getElementById("orders-edit-technician-field");
  const editRoomField = document.getElementById("orders-edit-room-field");
  const editCustomerField = document.getElementById("orders-edit-customer-field");
  const editEndTimeField = document.getElementById("orders-edit-end-time-field");
  const editDurationField = document.getElementById("orders-edit-duration-field");
  const editDurationDisplay = document.getElementById("orders-edit-duration-display");
  const editActualAmountField = document.getElementById("orders-edit-actual-amount-field");
  const editSubmitBtn = document.getElementById("orders-edit-submit");
  const editStartTimeField = document.getElementById("orders-edit-start-time-field");
  const editNoteField = document.getElementById("orders-edit-note-field");
  const editExtendCountField = document.getElementById("orders-edit-extend-count-field");
  const editExtendCount = document.getElementById("orders-edit-extend-count");
  const editExtendMinus = document.getElementById("orders-edit-extend-minus");
  const editExtendPlus = document.getElementById("orders-edit-extend-plus");

  const detailItems = document.getElementById("orders-detail-items");

  const urlParams = new URLSearchParams(window.location.search);
  const initialStatus = urlParams.get("status");
  const initialOrderNo = urlParams.get("orderNo");

  let currentDate = toLocalDateStr(new Date());
  let dateNavUpdating = false;
  let currentFilter = ["pending", "in_service", "completed", "all"].includes(initialStatus)
    ? initialStatus
    : "all";
  let currentPage = 1;
  let paginationTotal = 0;
  let paginationTotalPages = 1;
  let displayedOrders = [];
  let editingOrderId = null;
  let detailOrderId = null;
  let isExtendMode = false;
  let extendSourceOrder = null;

  function populateSelect(select, options, formatter, selectedValue = "") {
    if (!select) return;
    select.innerHTML = options.length
      ? options.map((option) => `<option value="${option.value}" ${option.value === selectedValue ? "selected" : ""}>${formatter(option)}</option>`).join("")
      : `<option value="">暂无可选项</option>`;
  }

  function buildCreateOptions() {
    populateSelect(createTechnician, technicians.map((item) => ({
      value: item.technician_user_id,
      name: item.name,
      serviceStatus: item.service_status
    })), (item) => `${item.name} · ${item.serviceStatus === "available" ? "待钟" : "服务中"}`);
    populateSelect(editTechnician, technicians.map((item) => ({
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
    populateSelect(editServiceItem, serviceItems.map((item) => ({
      value: item.id,
      name: item.name,
      price: item.list_price,
      duration: item.duration_minutes
    })), (item) => `${item.name} · ${formatCurrency(item.price)} · ${item.duration} 分钟`);

    populateSelect(createRoom, rooms.map((item) => ({ value: item.id, name: item.name, type: item.room_type })), (item) => `${item.name}${item.type ? ` · ${item.type}` : ""}`);
    populateSelect(editRoom, rooms.map((item) => ({ value: item.id, name: item.name, type: item.room_type })), (item) => `${item.name}${item.type ? ` · ${item.type}` : ""}`);

    const customerOptions = [{ value: "walk-in", name: "散客" }, ...customers.map((item) => ({
      value: item.id,
      name: `${item.name}${item.phone ? ` · ${item.phone}` : ""}${item.is_member ? " · 会员" : ""}`
    }))];
    populateSelect(createCustomer, customerOptions, (item) => item.name, "walk-in");
    populateSelect(editCustomer, customerOptions, (item) => item.name, "walk-in");
  }

  function renderServiceSummary(container, serviceItemId) {
    const serviceItem = serviceItems.find((item) => item.id === serviceItemId);
    renderRecords(container, serviceItem ? [
      ["项目名称", serviceItem.name],
      ["项目价格", formatCurrency(serviceItem.list_price)],
      ["服务时长", `${serviceItem.duration_minutes} 分钟`],
      ["订单类型", serviceItem.service_mode === "designated" ? "点钟" : "排钟"]
    ] : [["项目说明", "请选择项目后自动带出"]]);
  }

  function updateDateNav() {
    dateNavUpdating = true;
    if (dateNavLabel) dateNavLabel.textContent = formatDateLabel(currentDate);
    if (datePicker) datePicker.value = currentDate;
    const todayStr = toLocalDateStr(new Date());
    if (heroLabel) heroLabel.textContent = currentDate === todayStr ? "今日服务总营收" : `${formatDateLabel(currentDate)} 营收`;
    requestAnimationFrame(() => { dateNavUpdating = false; });
  }

  async function fetchOrders(page = 1, append = false) {
    const statusParam = currentFilter !== "all" ? currentFilter : "";
    const queryParams = new URLSearchParams({
      shopId: session.shopId,
      date: currentDate,
      page: String(page),
      limit: "20"
    });
    if (statusParam) queryParams.set("status", statusParam);

    try {
      const data = await apiRequest(`/merchant/orders?${queryParams}`, { headers });
      const orders = data.orders || [];
      const pagination = data.pagination || { total: 0, page: 1, limit: 20, totalPages: 1 };

      if (append) {
        displayedOrders = [...displayedOrders, ...orders];
      } else {
        displayedOrders = orders;
      }

      currentPage = pagination.page;
      paginationTotal = pagination.total;
      paginationTotalPages = pagination.totalPages;

      renderOrderList();
      renderSummary();
      updateLoadMore();

      // 如果有初始订单号，尝试查找并打开订单详情
      if (initialOrderNo && !detailOrderId) {
        const targetOrder = displayedOrders.find(o => o.order_no === initialOrderNo);
        if (targetOrder) {
          renderDetail(targetOrder);
          // 清除URL参数，避免重复打开
          window.history.replaceState({}, document.title, "./merchant-orders.html");
        }
      }
    } catch (error) {
      const list = document.getElementById("orders-list");
      renderFallback(list, `加载订单失败: ${error.message}`);
    }
  }

  function renderSummary() {
    const inServiceCount = displayedOrders.filter((o) => getOrderFilterKey(o) === "in_service").length;
    const completedCount = displayedOrders.filter((o) => getOrderFilterKey(o) === "completed").length;
    const pendingCount = displayedOrders.filter((o) => getOrderFilterKey(o) === "pending").length;
    const totalRevenue = displayedOrders.filter((o) => o.status === "completed").reduce((sum, o) => sum + Number(o.actual_amount || 0), 0);

    document.getElementById("orders-total-revenue").textContent = formatCurrency(totalRevenue);
    document.getElementById("orders-summary-service").textContent = String(inServiceCount);
    document.getElementById("orders-summary-pending").textContent = String(pendingCount);
    document.getElementById("orders-summary-completed").textContent = String(completedCount);
    document.getElementById("orders-total-count").textContent = String(paginationTotal);

    statusButtons.forEach((button) => {
      button.classList.toggle("active", button.dataset.orderStatusFilter === currentFilter);
    });
  }

  function updateLoadMore() {
    if (!loadMoreSection) return;
    const hasMore = currentPage < paginationTotalPages;
    loadMoreSection.hidden = !hasMore;
    if (loadMoreInfo) {
      loadMoreInfo.textContent = hasMore
        ? `已加载 ${displayedOrders.length} / ${paginationTotal} 条`
        : `共 ${paginationTotal} 条`;
    }
  }

  function renderOrderList() {
    const keyword = String(searchInput?.value || "").trim().toLowerCase();
    const filteredOrders = keyword
      ? displayedOrders.filter((order) =>
          [order.order_no, order.service_name, order.technician_name, order.customer_name]
            .filter(Boolean).join(" ").toLowerCase().includes(keyword)
        )
      : displayedOrders;

    const list = document.getElementById("orders-list");

    if (!filteredOrders.length) {
      renderFallback(list, "当前筛选条件下没有订单。");
      return;
    }

    list.innerHTML = filteredOrders.map((order) => {
      const meta = getOrderVisualMeta(order);
      const isInService = order.status === "in_service";
      const isCompleted = order.status === "completed";
      const remainingMinutes = getRemainingMinutes(order);
      const totalDuration = Math.max(60, Number(order.duration_minutes || 90));

      let actualDuration = totalDuration;
      if (isCompleted && order.start_time && order.end_time) {
        const startTime = new Date(order.start_time).getTime();
        const endTime = new Date(order.end_time).getTime();
        actualDuration = Math.max(1, Math.round((endTime - startTime) / 60000));
      }

      const fillWidth = isInService ? Math.max(10, Math.min(94, (1 - remainingMinutes / totalDuration) * 100)) : 0;
      const imminent = isInService && remainingMinutes <= 15;

      let durationLabel = "服务时长";
      let displayDuration = totalDuration;

      if (isInService) {
        durationLabel = "剩余时间";
        displayDuration = remainingMinutes;
      } else if (isCompleted) {
        durationLabel = "实际时长";
        displayDuration = actualDuration;
      }

      const amountBadge = isCompleted && order.actual_amount
        ? `<span class="mobile-order-amount-badge">${formatCurrency(order.actual_amount)}</span>`
        : "";

      return `
        <article class="mobile-order-card" data-order-view="${order.id}">
          <div class="mobile-order-head">
            <div class="merchant-mobile-avatar ${imminent ? "theme-bronze" : "theme-coral"}">${getInitial(order.service_name || order.technician_name)}</div>
            <div class="mobile-order-copy">
              <h3>${order.service_name || "服务项目"}</h3>
              <p>技师: ${order.technician_name || "--"}</p>
              <p>房间: ${order.room_name || order.room_code || "--"}</p>
            </div>
            <div class="mobile-order-status-column">
              <span class="mobile-status-pill ${imminent ? "warning" : meta.pill}">${imminent ? "即将结束" : meta.label}</span>
              ${amountBadge}
            </div>
          </div>
          ${isInService ? `
            <div class="mobile-progress-meta">
              <span>${durationLabel}</span>
              <strong>${displayDuration} MIN</strong>
            </div>
            <div class="mobile-progress-track">
              <div class="mobile-progress-fill ${imminent ? "is-amber" : "is-emerald"}" style="width: ${fillWidth.toFixed(0)}%"></div>
            </div>
          ` : `
            <div class="mobile-progress-meta">
              <span>${durationLabel}</span>
              <strong>${displayDuration} MIN</strong>
            </div>
          `}
          <div class="mobile-order-foot">
            <span>${order.order_no || "--"}</span>
            <span>${formatDateTimeRange(order.start_time, order.end_time, order.duration_minutes)}</span>
          </div>
        </article>
      `;
    }).join("");

    list.querySelectorAll("[data-order-view]").forEach((card) => {
      card.addEventListener("click", () => {
        const target = displayedOrders.find((order) => order.id === card.dataset.orderView);
        if (target) renderDetail(target);
      });
    });
  }

  function closePanels() {
    [filterPanel, createPanel, editPanel, detailPanel, settlePanel].forEach((panel) => {
      if (panel) panel.hidden = true;
    });
    if (backdrop) backdrop.hidden = true;
  }

  function openPanel(panel) {
    [filterPanel, createPanel, editPanel, detailPanel, settlePanel].forEach((item) => {
      if (item && item !== panel) item.hidden = true;
    });
    if (panel) panel.hidden = false;
    if (backdrop) backdrop.hidden = false;
  }

  function getOrderDurationInfo(order) {
    let durationInfo = `${Math.max(60, Number(order.duration_minutes || 90))} 分钟`;
    if (order.status === "completed" && order.start_time && order.end_time) {
      const startTime = new Date(order.start_time).getTime();
      const endTime = new Date(order.end_time).getTime();
      const actualMinutes = Math.max(1, Math.round((endTime - startTime) / 60000));
      durationInfo = `${actualMinutes} 分钟（实际）`;
    }
    return durationInfo;
  }

  function getEditOptions(order) {
    const technicianOptions = technicians.map((item) => ({
      value: item.technician_user_id,
      label: `${item.name} · ${item.service_status === "available" ? "待钟" : "服务中"}`
    }));
    const serviceOptions = serviceItems.map((item) => ({
      value: item.id,
      label: `${item.name} · ${formatCurrency(item.list_price)} · ${item.duration_minutes} 分钟`
    }));
    const roomOptions = rooms.map((item) => ({
      value: item.id,
      label: `${item.name}${item.room_type ? ` · ${item.room_type}` : ""}`
    }));
    const customerOptions = [{ value: "walk-in", label: "散客" }, ...customers.map((item) => ({
      value: item.id,
      label: `${item.name}${item.phone ? ` · ${item.phone}` : ""}${item.is_member ? " · 会员" : ""}`
    }))];

    return {
      technicianOptions,
      serviceOptions,
      roomOptions,
      customerOptions,
      selectedCustomer: order.customer_id || "walk-in"
    };
  }

  function renderDetailEdit(order) {
    const options = getEditOptions(order);
    const selectedServiceAmount = getServiceItemAmountCents(serviceItems, order.service_item_id) / 100;
    const isPending = order.status === "pending";
    const isCompleted = order.status === "completed";
    const settlementFields = isCompleted ? `
      <label class="mobile-form-field">
        <span>结束时间</span>
        <input id="orders-detail-edit-end-time" type="datetime-local" value="${order.end_time ? toDateTimeLocalValue(order.end_time) : ""}" />
      </label>
      <label class="mobile-form-field">
        <span>服务时长</span>
        <input value="${getOrderDurationInfo(order)}" disabled />
      </label>
      <label class="mobile-form-field">
        <span>实收金额</span>
        <input id="orders-detail-edit-actual-amount" type="text" inputmode="decimal" value="${formatAmountInputValue(order.actual_amount || 0)}" />
      </label>
    ` : `
      <label class="mobile-form-field">
        <span>${isPending ? "预计时长" : "服务时长"}</span>
        <input value="${getOrderDurationInfo(order)}" disabled />
      </label>
    `;
    editingOrderId = order.id;
    detailOrderId = order.id;

    detailItems.innerHTML = `
      <label class="mobile-form-field">
        <span>订单号</span>
        <input value="${order.order_no || "--"}" disabled />
      </label>
      <label class="mobile-form-field">
        <span>订单状态</span>
        <input value="${getOrderStatusLabel(order)}" disabled />
      </label>
      <label class="mobile-form-field">
        <span>订单类型</span>
        <input value="${getOrderTypeLabel(order)}" disabled />
      </label>
      <label class="mobile-form-field">
        <span>技师</span>
        <select id="orders-detail-edit-technician">${renderSelectOptions(options.technicianOptions, order.technician_user_id)}</select>
      </label>
      <label class="mobile-form-field">
        <span>服务项目</span>
        <select id="orders-detail-edit-service-item">${renderSelectOptions(options.serviceOptions, order.service_item_id)}</select>
      </label>
      <label class="mobile-form-field">
        <span>客户</span>
        <select id="orders-detail-edit-customer">${renderSelectOptions(options.customerOptions, options.selectedCustomer)}</select>
      </label>
      <label class="mobile-form-field">
        <span>房间</span>
        <select id="orders-detail-edit-room">${renderSelectOptions(options.roomOptions, order.room_id)}</select>
      </label>
      <label class="mobile-form-field">
        <span>开始时间</span>
        <input id="orders-detail-edit-start-time" type="datetime-local" value="${order.start_time ? toDateTimeLocalValue(order.start_time) : ""}" />
      </label>
      ${settlementFields}
      <label class="mobile-form-field">
        <span>服务金额</span>
        <input id="orders-detail-edit-service-amount" type="text" inputmode="decimal" value="${formatAmountInputValue(selectedServiceAmount)}" disabled />
      </label>
      <label class="mobile-form-field">
        <span>备注</span>
        <textarea id="orders-detail-edit-note" rows="4" placeholder="请输入订单备注">${order.note || ""}</textarea>
      </label>
      <p class="small" id="orders-detail-feedback" hidden></p>
    `;

    const detailServiceItem = document.getElementById("orders-detail-edit-service-item");
    const detailServiceAmount = document.getElementById("orders-detail-edit-service-amount");
    detailServiceItem?.addEventListener("change", () => {
      detailServiceAmount.value = formatAmountInputValue(getServiceItemAmountCents(serviceItems, detailServiceItem.value) / 100);
    });
    bindAmountInputNormalization(document.getElementById("orders-detail-edit-actual-amount"));
    setDetailActions(order, true);
    openPanel(detailPanel);
  }

  function setDetailActions(order, isEditing = false) {
    const manageButton = document.getElementById("orders-manage-button");
    const startButton = document.getElementById("orders-start-button");
    const endButton = document.getElementById("orders-end-button");
    const extendButton = document.getElementById("orders-extend-button");
    const endExtendRow = document.getElementById("orders-end-extend-row");
    const deleteButton = document.getElementById("orders-detail-delete-button");
    const saveButton = document.getElementById("orders-detail-save-button");
    const deleteSaveRow = document.getElementById("orders-delete-save-row");

    manageButton.hidden = isEditing;
    startButton.hidden = isEditing || order.status !== "pending";
    const showEndExtend = !isEditing && order.status === "in_service";
    endButton.hidden = !showEndExtend;
    extendButton.hidden = !showEndExtend;
    endExtendRow.hidden = !showEndExtend;
    deleteButton.hidden = !isEditing;
    saveButton.hidden = !isEditing;
    deleteSaveRow.hidden = !isEditing;
  }

  function renderDetail(order) {
    detailOrderId = order.id;

    const durationInfo = getOrderDurationInfo(order);

    renderRecords(detailItems, [
      ["订单号", order.order_no || "--"],
      ["服务项目", order.service_name || "--"],
      ["技师", order.technician_name || "--"],
      ["客户", order.customer_type === "registered" ? (order.customer_name || "--") : "散客"],
      ["房间", order.room_name || order.room_code || "--"],
      ["开始时间", order.start_time ? formatDateTime(order.start_time) : "未开始"],
      ["结束时间", order.end_time ? formatDateTime(order.end_time) : order.status === "pending" ? "未开始" : "进行中"],
      ["服务时长", durationInfo],
      ["服务金额", formatCurrency(order.service_amount)],
      ["实收金额", order.status === "completed" && order.actual_amount ? formatCurrency(order.actual_amount) : "待结算"],
      ["备注", order.note || "暂无备注"]
    ]);

    setDetailActions(order);
    openPanel(detailPanel);
  }

  function renderEdit(order) {
    isExtendMode = false;
    extendSourceOrder = null;
    editingOrderId = order.id;
    editTitle.textContent = "订单管理";
    document.getElementById("orders-edit-order-no").textContent = order.order_no || "--";

    editRecords.hidden = false;
    editTechnicianField.hidden = false;
    editTechnician.disabled = false;
    editExtendCountField.hidden = true;
    editRoomField.hidden = false;
    editCustomerField.hidden = false;
    editStartTimeField.hidden = false;
    editEndTimeField.hidden = false;
    editDurationField.hidden = true;
    editActualAmountField.hidden = false;
    editNoteField.hidden = false;
    editDeleteBtn.hidden = false;
    editSubmitBtn.textContent = "保存订单";

    let durationInfo = `${Math.max(60, Number(order.duration_minutes || 90))} 分钟`;
    if (order.status === "completed" && order.start_time && order.end_time) {
      const startTime = new Date(order.start_time).getTime();
      const endTime = new Date(order.end_time).getTime();
      const actualMinutes = Math.max(1, Math.round((endTime - startTime) / 60000));
      durationInfo = `${actualMinutes} 分钟（实际）`;
    }

    renderRecords(editRecords, [
      ["订单号", order.order_no || "--"],
      ["订单状态", getOrderStatusLabel(order)],
      ["订单类型", getOrderTypeLabel(order)],
      ["服务项目", order.service_name || "--"],
      ["技师", order.technician_name || "--"],
      ["客户", order.customer_type === "registered" ? (order.customer_name || "--") : "散客"],
      ["房间", order.room_name || order.room_code || "--"],
      ["开始时间", order.start_time ? formatDateTime(order.start_time) : "未开始"],
      ["结束时间", order.end_time ? formatDateTime(order.end_time) : order.status === "pending" ? "未开始" : "进行中"],
      ["服务时长", durationInfo]
    ]);

    populateSelect(editTechnician, technicians.map((item) => ({
      value: item.technician_user_id,
      name: item.name,
      serviceStatus: item.service_status
    })), (item) => `${item.name} · ${item.serviceStatus === "available" ? "待钟" : "服务中"}`, order.technician_user_id);
    populateSelect(editServiceItem, serviceItems.map((item) => ({
      value: item.id,
      name: item.name,
      price: item.list_price,
      duration: item.duration_minutes
    })), (item) => `${item.name} · ${formatCurrency(item.price)} · ${item.duration} 分钟`, order.service_item_id);
    populateSelect(editRoom, rooms.map((item) => ({ value: item.id, name: item.name, type: item.room_type })), (item) => `${item.name}${item.type ? ` · ${item.type}` : ""}`, order.room_id);
    const selectedCustomer = order.customer_id || "walk-in";
    const customerOptions = [{ value: "walk-in", name: "散客" }, ...customers.map((item) => ({
      value: item.id,
      name: `${item.name}${item.phone ? ` · ${item.phone}` : ""}${item.is_member ? " · 会员" : ""}`
    }))];
    populateSelect(editCustomer, customerOptions, (item) => item.name, selectedCustomer);
    editStartTime.value = order.start_time ? toDateTimeLocalValue(order.start_time) : "";
    editEndTime.value = order.end_time ? toDateTimeLocalValue(order.end_time) : "";
    editServiceAmount.value = formatAmountInputValue(getServiceItemAmountCents(serviceItems, order.service_item_id) / 100);
    editActualAmount.value = formatAmountInputValue(order.actual_amount || 0);
    editNote.value = order.note || "";
    renderServiceSummary(editServiceSummary, order.service_item_id);
    showFieldFeedback("orders-edit-feedback", "");
    openPanel(editPanel);
  }

  function renderExtend(order) {
    isExtendMode = true;
    extendSourceOrder = order;
    editingOrderId = null;
    editTitle.textContent = "加钟";
    document.getElementById("orders-edit-order-no").textContent = `${order.technician_name || "当前技师"} · ${order.room_name || order.room_code || "当前房间"}`;

    editRecords.hidden = true;
    editTechnicianField.hidden = true;
    editExtendCountField.hidden = false;
    editRoomField.hidden = true;
    editCustomerField.hidden = true;
    editStartTimeField.hidden = true;
    editEndTimeField.hidden = true;
    editDurationField.hidden = true;
    editActualAmountField.hidden = true;
    editNoteField.hidden = true;
    editDeleteBtn.hidden = true;
    editSubmitBtn.textContent = "确认加钟";

    editExtendCount.value = 1;

    populateSelect(editTechnician, technicians.map((item) => ({
      value: item.technician_user_id,
      name: item.name,
      serviceStatus: item.service_status
    })), (item) => `${item.name} · ${item.serviceStatus === "available" ? "待钟" : "服务中"}`, order.technician_user_id);
    populateSelect(editServiceItem, serviceItems.map((item) => ({
      value: item.id,
      name: item.name,
      price: item.list_price,
      duration: item.duration_minutes
    })), (item) => `${item.name} · ${formatCurrency(item.price)} · ${item.duration} 分钟`, order.service_item_id);
    populateSelect(editRoom, rooms.map((item) => ({ value: item.id, name: item.name, type: item.room_type })), (item) => `${item.name}${item.type ? ` · ${item.type}` : ""}`, order.room_id);

    const extendStartTime = computeExpectedEndTime(order);
    editStartTime.value = toDateTimeLocalValue(extendStartTime);
    editEndTime.value = "";
    editNote.value = "";

    updateExtendAmount();

    renderServiceSummary(editServiceSummary, editServiceItem?.value);
    showFieldFeedback("orders-edit-feedback", "");
    openPanel(editPanel);
  }

  function computeExpectedEndTime(order) {
    const startTime = order.start_time ? new Date(order.start_time) : new Date();
    const durationMinutes = Math.max(60, Number(order.duration_minutes || 90));
    return new Date(startTime.getTime() + durationMinutes * 60000);
  }

  function updateExtendAmount() {
    if (!editServiceItem?.value) return;
    const selectedService = serviceItems.find((item) => item.id === editServiceItem.value);
    if (!selectedService) return;
    const count = Math.max(1, Math.min(10, Number(editExtendCount?.value || 1)));
    const unitPrice = Number(selectedService.list_price || 0);
    const totalAmount = unitPrice * count;
    editServiceAmount.value = formatAmountInputValue(totalAmount);
    if (editDurationDisplay) {
      const totalMinutes = (selectedService.duration_minutes || 60) * count;
      editDurationDisplay.value = `${totalMinutes} 分钟`;
    }
  }

  function shiftDate(days) {
    const parts = currentDate.split("-");
    const d = new Date(Number(parts[0]), Number(parts[1]) - 1, Number(parts[2]));
    d.setDate(d.getDate() + days);
    currentDate = toLocalDateStr(d);
    updateDateNav();
    currentPage = 1;
    fetchOrders(1);
  }

  function openDatePicker() {
    if (datePicker && typeof datePicker.showPicker === "function") {
      datePicker.showPicker();
    } else if (datePicker) {
      datePicker.focus();
    }
  }

  window.__zubaoOpenDatePicker = openDatePicker;

  datePrevBtn?.addEventListener("click", () => shiftDate(-1));
  dateNextBtn?.addEventListener("click", () => shiftDate(1));
  datePicker?.addEventListener("change", () => {
    if (dateNavUpdating) return;
    if (datePicker.value) {
      currentDate = datePicker.value;
      updateDateNav();
      currentPage = 1;
      fetchOrders(1);
    }
  });

  loadMoreBtn?.addEventListener("click", () => {
    if (currentPage < paginationTotalPages) {
      fetchOrders(currentPage + 1, true);
    }
  });

  searchInput?.addEventListener("input", () => {
    renderOrderList();
  });
  dateInput?.addEventListener("change", () => {
    currentPage = 1;
    fetchOrders(1);
  });

  statusButtons.forEach((button) => {
    button.addEventListener("click", () => {
      currentFilter = button.dataset.orderStatusFilter;
      currentPage = 1;
      fetchOrders(1);
    });
  });

  document.getElementById("orders-filter-toggle")?.addEventListener("click", () => openPanel(filterPanel));
  document.getElementById("orders-filter-close")?.addEventListener("click", closePanels);
  document.getElementById("orders-create-toggle")?.addEventListener("click", () => openPanel(createPanel));
  document.getElementById("orders-create-cancel")?.addEventListener("click", closePanels);

  document.querySelectorAll(".mobile-order-type-btn").forEach((btn) => {
    btn.addEventListener("click", () => {
      document.querySelectorAll(".mobile-order-type-btn").forEach((b) => b.classList.remove("active"));
      btn.classList.add("active");
    });
  });

  document.getElementById("orders-edit-cancel")?.addEventListener("click", closePanels);
  document.getElementById("orders-detail-close")?.addEventListener("click", closePanels);
  backdrop?.addEventListener("click", closePanels);

  document.getElementById("orders-start-button")?.addEventListener("click", async () => {
    if (!detailOrderId) return;
    const target = displayedOrders.find((order) => order.id === detailOrderId);
    if (!target || target.status !== "pending") return;
    try {
      const response = await apiRequest(`/merchant/orders/${detailOrderId}/start?shopId=${session.shopId}`, {
        method: "POST",
        headers
      });
      Object.assign(target, response.order || {});
      currentFilter = "in_service";
      fetchOrders(1);
      closePanels();
    } catch (error) {
      alert(`开始订单失败: ${error.message}`);
    }
  });

  document.getElementById("orders-end-button")?.addEventListener("click", () => {
    if (!detailOrderId) return;
    const target = displayedOrders.find((order) => order.id === detailOrderId);
    if (!target) return;
    const settleServiceAmount = document.getElementById("orders-settle-service-amount");
    const settleActualAmount = document.getElementById("orders-settle-actual-amount");
    const settleOrderNo = document.getElementById("orders-settle-order-no");
    const settleNote = document.getElementById("orders-settle-note");
    const settleFeedback = document.getElementById("orders-settle-feedback");
    if (settleServiceAmount) {
      settleServiceAmount.value = formatAmountInputValue(target.service_amount || 0);
    }
    if (settleActualAmount) {
      settleActualAmount.value = formatAmountInputValue(target.service_amount || 0);
    }
    if (settleOrderNo) {
      settleOrderNo.textContent = target.order_no || "--";
    }
    if (settleNote) settleNote.value = "";
    if (settleFeedback) { settleFeedback.hidden = true; settleFeedback.textContent = ""; }
    openPanel(settlePanel);
  });

  document.getElementById("orders-settle-close")?.addEventListener("click", () => {
    openPanel(detailPanel);
  });

  document.getElementById("orders-settle-cancel")?.addEventListener("click", () => {
    openPanel(detailPanel);
  });

  document.getElementById("orders-settle-confirm")?.addEventListener("click", async () => {
    if (!detailOrderId) return;
    const target = displayedOrders.find((order) => order.id === detailOrderId);
    if (!target) return;
    try {
      const settleActualAmount = document.getElementById("orders-settle-actual-amount");
      const settleNote = document.getElementById("orders-settle-note");
      const actualAmountValue = settleActualAmount?.value ? parseAmountInputValue(settleActualAmount.value) : null;
      const noteValue = settleNote?.value.trim() || null;
      if (actualAmountValue !== null && actualAmountValue >= 0) {
        await apiRequest(`/merchant/orders/${detailOrderId}?shopId=${session.shopId}`, {
          method: "PATCH",
          headers,
          body: {
            actualAmount: actualAmountValue,
            ...(noteValue ? { note: noteValue } : {})
          }
        });
      }
      await apiRequest(`/merchant/orders/${detailOrderId}/complete?shopId=${session.shopId}`, {
        method: "POST",
        headers
      });
      Object.assign(target, { status: "completed", end_time: new Date().toISOString() });
      if (actualAmountValue !== null && actualAmountValue >= 0) {
        target.actual_amount = actualAmountValue;
      }
      if (noteValue) target.note = noteValue;
      fetchOrders(1);
      closePanels();
    } catch (error) {
      const settleFeedback = document.getElementById("orders-settle-feedback");
      if (settleFeedback) {
        settleFeedback.textContent = error.message;
        settleFeedback.hidden = false;
        settleFeedback.style.color = "#dc2626";
      }
    }
  });

  document.getElementById("orders-extend-button")?.addEventListener("click", () => {
    if (!detailOrderId) return;
    const target = displayedOrders.find((order) => order.id === detailOrderId);
    if (target) renderExtend(target);
  });

  document.getElementById("orders-manage-button")?.addEventListener("click", () => {
    if (!detailOrderId) return;
    const target = displayedOrders.find((order) => order.id === detailOrderId);
    if (target) renderDetailEdit(target);
  });

  document.getElementById("orders-detail-save-button")?.addEventListener("click", async () => {
    if (!detailOrderId) return;
    try {
      showFieldFeedback("orders-detail-feedback", "");
      const customerValue = document.getElementById("orders-detail-edit-customer")?.value || "walk-in";
      const endTimeInput = document.getElementById("orders-detail-edit-end-time");
      const actualAmountInput = document.getElementById("orders-detail-edit-actual-amount");
      const body = {
        technicianUserId: document.getElementById("orders-detail-edit-technician")?.value,
        serviceItemId: document.getElementById("orders-detail-edit-service-item")?.value,
        roomId: document.getElementById("orders-detail-edit-room")?.value,
        customerId: customerValue !== "walk-in" ? customerValue : null,
        customerType: customerValue !== "walk-in" ? "registered" : "walk_in",
        startTime: document.getElementById("orders-detail-edit-start-time")?.value
          ? new Date(document.getElementById("orders-detail-edit-start-time").value).toISOString()
          : null,
        serviceAmount: getServiceItemAmountCents(serviceItems, document.getElementById("orders-detail-edit-service-item")?.value),
        note: document.getElementById("orders-detail-edit-note")?.value.trim()
      };

      if (endTimeInput) {
        body.endTime = endTimeInput.value ? new Date(endTimeInput.value).toISOString() : null;
      }
      if (actualAmountInput) {
        body.actualAmount = parseAmountInputValue(actualAmountInput.value);
      }

      const response = await apiRequest(`/merchant/orders/${detailOrderId}?shopId=${session.shopId}`, {
        method: "PATCH",
        headers,
        body
      });
      const target = displayedOrders.find((order) => order.id === detailOrderId);
      if (target) Object.assign(target, response.order || {});
      fetchOrders(1);
      renderDetail(target || response.order);
    } catch (error) {
      showFieldFeedback("orders-detail-feedback", error.message, true);
    }
  });

  document.getElementById("orders-detail-delete-button")?.addEventListener("click", async () => {
    if (!detailOrderId) return;
    if (!confirm("确定要永久删除这个订单吗？此操作无法撤销！")) return;
    try {
      await apiRequest(`/merchant/orders/${detailOrderId}?shopId=${session.shopId}`, {
        method: "DELETE",
        headers
      });
      displayedOrders = displayedOrders.filter((order) => order.id !== detailOrderId);
      closePanels();
      fetchOrders(1);
    } catch (error) {
      showFieldFeedback("orders-detail-feedback", error.message, true);
    }
  });

  document.getElementById("orders-create-submit")?.addEventListener("click", async () => {
    try {
      showFieldFeedback("orders-create-feedback", "");
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
      currentFilter = "pending";
      fetchOrders(1);
      closePanels();
    } catch (error) {
      showFieldFeedback("orders-create-feedback", error.message, true);
    }
  });

  document.getElementById("orders-edit-submit")?.addEventListener("click", async () => {
    if (isExtendMode) {
      try {
        showFieldFeedback("orders-edit-feedback", "");
        if (!extendSourceOrder) return;
        const extendCount = Math.max(1, Math.min(10, Number(editExtendCount?.value || 1)));
        const selectedService = serviceItems.find((item) => item.id === editServiceItem?.value);
        if (!selectedService) {
          showFieldFeedback("orders-edit-feedback", "请选择服务项目", true);
          return;
        }
        const extendDurationPerUnit = Number(selectedService.duration_minutes || 60);
        const extendAmountPerUnit = Number(selectedService.list_price || 0);
        const totalExtendDuration = extendDurationPerUnit * extendCount;
        const totalExtendAmount = extendAmountPerUnit * extendCount;
        const originalDuration = Math.max(60, Number(extendSourceOrder.duration_minutes || 90));
        const originalServiceAmount = Number(extendSourceOrder.service_amount || 0);
        const originalActualAmount = Number(extendSourceOrder.actual_amount || 0);
        const newDuration = originalDuration + totalExtendDuration;
        const newServiceAmount = originalServiceAmount + totalExtendAmount;
        const newActualAmount = originalActualAmount + totalExtendAmount;
        const existingNote = extendSourceOrder.note || "";
        const extendItemName = selectedService.name || "项目";
        let compositionNote = "";
        if (existingNote.includes("订单构成：")) {
          compositionNote = existingNote + `\n+ ${extendItemName} × ${extendCount}（${totalExtendDuration}分钟 / ${formatCurrency(totalExtendAmount)}）`;
        } else {
          compositionNote = `订单构成：\n${extendSourceOrder.service_name || "项目"} × 1（${originalDuration}分钟 / ${formatCurrency(originalServiceAmount)}）\n+ ${extendItemName} × ${extendCount}（${totalExtendDuration}分钟 / ${formatCurrency(totalExtendAmount)}）`;
          if (existingNote) compositionNote += `\n\n备注：${existingNote}`;
        }
        const response = await apiRequest(`/merchant/orders/${extendSourceOrder.id}?shopId=${session.shopId}`, {
          method: "PATCH",
          headers,
          body: {
            durationMinutes: newDuration,
            serviceAmount: Math.round(newServiceAmount * 100),
            actualAmount: Math.round(newActualAmount * 100),
            note: compositionNote
          }
        });
        if (response.order) {
          Object.assign(extendSourceOrder, response.order);
        } else {
          extendSourceOrder.duration_minutes = newDuration;
          extendSourceOrder.service_amount = newServiceAmount;
          extendSourceOrder.actual_amount = newActualAmount;
          extendSourceOrder.note = compositionNote;
        }
        currentFilter = "in_service";
        closePanels();
        fetchOrders(1);
      } catch (error) {
        showFieldFeedback("orders-edit-feedback", error.message, true);
      }
      return;
    }

    if (!editingOrderId) return;
    try {
      showFieldFeedback("orders-edit-feedback", "");
      const customerValue = editCustomer?.value || "walk-in";
      const response = await apiRequest(`/merchant/orders/${editingOrderId}?shopId=${session.shopId}`, {
        method: "PATCH",
        headers,
        body: {
          technicianUserId: editTechnician?.value,
          serviceItemId: editServiceItem?.value,
          roomId: editRoom?.value,
          customerId: customerValue !== "walk-in" ? customerValue : null,
          customerType: customerValue !== "walk-in" ? "registered" : "walk_in",
          startTime: editStartTime?.value ? new Date(editStartTime.value).toISOString() : null,
          endTime: editEndTime?.value ? new Date(editEndTime.value).toISOString() : null,
          serviceAmount: getServiceItemAmountCents(serviceItems, editServiceItem?.value),
          actualAmount: parseAmountInputValue(editActualAmount?.value),
          note: editNote?.value.trim()
        }
      });
      const target = displayedOrders.find((order) => order.id === editingOrderId);
      if (target) Object.assign(target, response.order || {});
      closePanels();
      fetchOrders(1);
    } catch (error) {
      showFieldFeedback("orders-edit-feedback", error.message, true);
    }
  });

  editDeleteBtn?.addEventListener("click", async () => {
    if (!editingOrderId) return;
    if (!confirm("确定要永久删除这个订单吗？此操作无法撤销！")) return;
    try {
      await apiRequest(`/merchant/orders/${editingOrderId}?shopId=${session.shopId}`, {
        method: "DELETE",
        headers
      });
      displayedOrders = displayedOrders.filter((order) => order.id !== editingOrderId);
      closePanels();
      fetchOrders(1);
    } catch (error) {
      showFieldFeedback("orders-edit-feedback", error.message, true);
    }
  });

  buildCreateOptions();
  if (dateInput) dateInput.value = "";
  if (createStartTime) createStartTime.value = toDateTimeLocalValue(new Date());
  renderServiceSummary(createSummary, createServiceItem?.value);
  renderServiceSummary(editServiceSummary, editServiceItem?.value);
  bindAmountInputNormalization(editServiceAmount);
  bindAmountInputNormalization(editActualAmount);

  createServiceItem?.addEventListener("change", () => renderServiceSummary(createSummary, createServiceItem.value));
  editServiceItem?.addEventListener("change", () => {
    renderServiceSummary(editServiceSummary, editServiceItem.value);
    if (editServiceAmount) {
      editServiceAmount.value = formatAmountInputValue(getServiceItemAmountCents(serviceItems, editServiceItem.value) / 100);
    }
    if (isExtendMode) {
      updateExtendAmount();
    }
  });

  editExtendMinus?.addEventListener("click", () => {
    const current = Math.max(1, Number(editExtendCount?.value || 1));
    if (current > 1) {
      editExtendCount.value = current - 1;
      if (isExtendMode) updateExtendAmount();
    }
  });

  editExtendPlus?.addEventListener("click", () => {
    const current = Math.max(1, Number(editExtendCount?.value || 1));
    if (current < 10) {
      editExtendCount.value = current + 1;
      if (isExtendMode) updateExtendAmount();
    }
  });

  editExtendCount?.addEventListener("input", () => {
    if (isExtendMode) updateExtendAmount();
  });

  if (urlParams.get("openCreate") === "1") {
    openPanel(createPanel);
  }

  updateDateNav();
  await fetchOrders(1);

  const focusedOrderId = urlParams.get("orderId");
  if (focusedOrderId) {
    const target = displayedOrders.find((order) => order.id === focusedOrderId);
    if (target) {
      currentFilter = getOrderFilterKey(target);
      renderDetail(target);
    }
  }
}

export default async function init() {
  await initMerchantOrders();
}
