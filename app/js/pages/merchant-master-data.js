import { getSession, setSession, clearSession, getHomePathByRole, ensureMerchantSession, ensureTechnicianSession, DEFAULT_SHOP_ID } from "../utils/session.js";
import { apiRequest } from "../utils/api.js";
import { formatCurrency, formatAmountInputValue, parseAmountInputValue, normalizeAmountInputElement, bindAmountInputNormalization, formatMonth, formatDateTime, toDateTimeLocalValue, getInitial } from "../utils/format.js";
import { showFieldFeedback, downloadTextFile, renderFallback } from "../utils/dom.js";

export async function initMerchantMasterData() {
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
  const serviceResetButtonHero = document.getElementById("service-item-reset-button-hero");
  const customerResetButtonHero = document.getElementById("customer-reset-button-hero");

  bindAmountInputNormalization(servicePriceInput);

  function renderMasterDataSummary() {
    const activeServiceCount = serviceItems.filter((item) => item.is_active).length;
    const activeRoomCount = rooms.filter((item) => item.is_active).length;
    const activeCustomerCount = customers.filter((item) => item.is_active).length;
    const focusCopy = document.getElementById("master-data-focus-copy");
    if (focusCopy) {
      focusCopy.textContent = `当前已维护 ${serviceItems.length} 个项目、${rooms.length} 个房间和 ${customers.length} 位客户，开单时可直接选择。`;
    }
    const serviceChip = document.getElementById("master-data-chip-services");
    if (serviceChip) serviceChip.textContent = `项目 ${serviceItems.length} 个`;
    const roomChip = document.getElementById("master-data-chip-rooms");
    if (roomChip) roomChip.textContent = `房间 ${rooms.length} 个`;
    const customerChip = document.getElementById("master-data-chip-customers");
    if (customerChip) customerChip.textContent = `客户 ${customers.length} 位`;
    const serviceSummary = document.getElementById("master-data-summary-services");
    if (serviceSummary) serviceSummary.textContent = `${activeServiceCount} 个`;
    const roomSummary = document.getElementById("master-data-summary-rooms");
    if (roomSummary) roomSummary.textContent = `${activeRoomCount} 个`;
    const customerSummary = document.getElementById("master-data-summary-customers");
    if (customerSummary) customerSummary.textContent = `${activeCustomerCount} 位`;
  }

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
          renderMasterDataSummary();
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
          renderMasterDataSummary();
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
          renderMasterDataSummary();
        } catch (error) {
          showFieldFeedback("customer-feedback", error.message, true);
        }
      });
    });
  }

  document.getElementById("service-item-reset-button")?.addEventListener("click", resetServiceItemForm);
  document.getElementById("room-reset-button")?.addEventListener("click", resetRoomForm);
  document.getElementById("customer-reset-button")?.addEventListener("click", resetCustomerForm);
  serviceResetButtonHero?.addEventListener("click", () => {
    resetServiceItemForm();
    serviceNameInput?.focus();
  });
  customerResetButtonHero?.addEventListener("click", () => {
    resetCustomerForm();
    customerNameInput?.focus();
  });

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
      renderMasterDataSummary();
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
      renderMasterDataSummary();
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
      renderMasterDataSummary();
      showFieldFeedback("customer-feedback", "客户档案已保存。");
    } catch (error) {
      showFieldFeedback("customer-feedback", error.message, true);
    }
  });

  renderServiceItems();
  renderRooms();
  renderCustomers();
  renderMasterDataSummary();
}

export default async function init() {
  await initMerchantMasterData();
}
