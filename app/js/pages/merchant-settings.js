import { API_BASE_URL, ensureMerchantSession, clearSession } from "../utils/session.js";
import { apiRequest } from "../utils/api.js";
import { showFieldFeedback } from "../utils/dom.js";

function renderRecords(container, rows) {
  if (!container) return;
  container.innerHTML = rows.map(([label, value]) => `
    <div class="record-row">
      <div class="small">${label}</div>
      <div>${value}</div>
    </div>
  `).join("");
}

function createTechnicianJoinUrl(shopId) {
  const url = window.location.protocol === "file:"
    ? new URL("/technician-join-shop.html", API_BASE_URL.replace(/\/api\/v1$/, ""))
    : new URL("./technician-join-shop.html", window.location.href);

  if (window.location.protocol === "file:" && url.port === "3001") {
    url.port = "8080";
  }

  url.searchParams.set("shopId", shopId);
  return url.href;
}

function createQrCodeUrl(value) {
  return `https://api.qrserver.com/v1/create-qr-code/?size=300x300&data=${encodeURIComponent(value)}`;
}

function pickFirstNonEmpty(...values) {
  return values.find((value) => typeof value === "string" && value.trim()) || "";
}

export async function initMerchantSettings() {
  const session = ensureMerchantSession();
  const headers = {
    "x-shop-id": session.shopId,
    "x-user-id": session.user.id
  };

  const [settingsData, applicationData] = await Promise.all([
    apiRequest(`/merchant/settings?shopId=${session.shopId}`, { headers }),
    apiRequest(`/merchant/technician-applications?shopId=${session.shopId}`, { headers })
  ]);

  const info = settingsData.shop || {};
  const stats = settingsData.stats || {};
  const applications = applicationData.applications || [];
  const backdrop = document.getElementById("settings-sheet-backdrop");
  const menuBackdrop = document.getElementById("settings-menu-backdrop");
  const editPanel = document.getElementById("settings-edit-panel");
  const menuPanel = document.getElementById("settings-menu-panel");
  const qrImage = document.getElementById("settings-recruit-qr");

  const nameInput = document.getElementById("settings-shop-name-input");
  const managerInput = document.getElementById("settings-manager-name-input");
  const phoneInput = document.getElementById("settings-contact-phone-input");
  const addressInput = document.getElementById("settings-address-input");
  const qrInput = document.getElementById("settings-qr-code-input");
  const hoursStartInput = document.getElementById("settings-opening-start-input");
  const hoursEndInput = document.getElementById("settings-opening-end-input");

  function closePanel() {
    editPanel.hidden = true;
    backdrop.hidden = true;
  }

  function openPanel() {
    nameInput.value = info.name || "";
    managerInput.value = pickFirstNonEmpty(info.manager_name, info.managerName, info.owner_name, info.ownerName);
    phoneInput.value = pickFirstNonEmpty(info.contact_phone, info.contactPhone, info.phone, info.owner_phone, info.ownerPhone);
    addressInput.value = info.address || "";
    qrInput.value = info.qr_code_url || "";
    const hours = info.opening_hours || info.openingHours || "";
    const [startHour, endHour] = hours.split("-");
    hoursStartInput.value = startHour || "";
    hoursEndInput.value = endHour || "";
    
    editPanel.hidden = false;
    backdrop.hidden = false;
  }

  function closeMenu() {
    menuPanel.hidden = true;
    menuBackdrop.hidden = true;
  }

  function openMenu() {
    menuPanel.hidden = false;
    menuBackdrop.hidden = false;
  }

  function isWithinHours(hours) {
      if (!hours) return false;
      const [start, end] = hours.split("-");
      if (!start || !end) return false;
      const now = new Date();
      const currentMinutes = now.getHours() * 60 + now.getMinutes();
      const [startHour, startMin] = start.split(":").map(Number);
      const [endHour, endMin] = end.split(":").map(Number);
      const startMinutes = startHour * 60 + startMin;
      const endMinutes = endHour * 60 + endMin;
      
      if (startMinutes <= endMinutes) {
        return currentMinutes >= startMinutes && currentMinutes <= endMinutes;
      } else {
        return currentMinutes >= startMinutes || currentMinutes <= endMinutes;
      }
    }

  function renderInfo(shop) {
    document.getElementById("settings-shop-title").textContent = shop.name || "门店名称待完善";
    document.getElementById("settings-shop-subtitle").textContent = shop.address || "请补充门店地址";
    document.getElementById("settings-shop-manager").textContent = pickFirstNonEmpty(
      shop.manager_name,
      shop.managerName,
      shop.owner_name,
      shop.ownerName
    ) || "负责人待完善";
    document.getElementById("settings-shop-phone").textContent = pickFirstNonEmpty(
      shop.contact_phone,
      shop.contactPhone,
      shop.phone,
      shop.owner_phone,
      shop.ownerPhone
    ) || "联系电话待完善";
    
    const statusElement = document.getElementById("settings-shop-status");
    const isOpen = isWithinHours(shop.opening_hours || shop.openingHours);
    if (statusElement) {
      statusElement.textContent = isOpen ? "营业中" : "休息中";
      statusElement.className = `mobile-tag is-primary`;
    }
    
    const pendingCount = applications.filter((item) => item.status === "pending").length;
    document.getElementById("settings-application-count").textContent = `${pendingCount} 条待处理申请`;
    
    const availableRooms = Number(stats.available_rooms || 0);
    const totalRooms = Number(stats.total_rooms || 0);
    const occupiedRooms = totalRooms - availableRooms;
    document.getElementById("settings-rooms-count").textContent = `${availableRooms} 间空闲 / ${occupiedRooms} 间占用`;
    
    const totalCustomers = Number(stats.total_customers || 0);
    document.getElementById("settings-customers-count").textContent = `累计会员 ${totalCustomers.toLocaleString()} 位`;
    
    const totalServices = Number(stats.total_services || 0);
    document.getElementById("settings-services-count").textContent = `${totalServices} 个服务项目`;
    
    document.getElementById("settings-focus-copy").textContent = shop.address
      ? `当前门店资料已录入，地址为 ${shop.address}。`
      : "店铺信息、二维码和订阅状态都在这里统一管理。";
    if (qrImage) {
      const joinUrl = createTechnicianJoinUrl(session.shopId);
      // 添加错误处理，防止二维码加载失败影响页面
      qrImage.onerror = function() {
        this.style.display = 'none';
        console.log('二维码服务暂时不可用');
      };
      qrImage.src = createQrCodeUrl(joinUrl);
      qrImage.alt = `${shop.name || "当前门店"}技师入驻申请二维码`;
      qrImage.dataset.joinUrl = joinUrl;
    }
  }

  renderInfo(info);
  nameInput.value = info.name || "";
  managerInput.value = pickFirstNonEmpty(info.manager_name, info.managerName, info.owner_name, info.ownerName);
  phoneInput.value = pickFirstNonEmpty(info.contact_phone, info.contactPhone, info.phone, info.owner_phone, info.ownerPhone);
  addressInput.value = info.address || "";
  qrInput.value = info.qr_code_url || "";
  const hours = info.opening_hours || info.openingHours || "";
  const [startHour, endHour] = hours.split("-");
  hoursStartInput.value = startHour || "";
  hoursEndInput.value = endHour || "";

  document.getElementById("settings-edit-toggle")?.addEventListener("click", openPanel);
  document.getElementById("settings-edit-close")?.addEventListener("click", closePanel);
  backdrop?.addEventListener("click", closePanel);

  document.getElementById("settings-menu-button")?.addEventListener("click", openMenu);
  document.getElementById("settings-menu-backdrop")?.addEventListener("click", closeMenu);

  document.getElementById("settings-menu-edit-profile")?.addEventListener("click", () => {
    closeMenu();
    openPanel();
  });

  document.getElementById("settings-menu-avatar")?.addEventListener("click", () => {
    alert("账号头像设置功能开发中");
    closeMenu();
  });

  document.getElementById("settings-menu-logout")?.addEventListener("click", () => {
    if (confirm("确定要退出登录吗？")) {
      clearSession();
      location.href = "./login.html";
    }
  });

  document.getElementById("settings-save-button")?.addEventListener("click", async () => {
    try {
      showFieldFeedback("settings-feedback", "");
      const openingHours = [hoursStartInput?.value.trim(), hoursEndInput?.value.trim()].filter(Boolean).join("-");
      const result = await apiRequest(`/merchant/settings?shopId=${session.shopId}`, {
        method: "PUT",
        headers,
        body: {
          name: nameInput?.value.trim(),
          managerName: managerInput?.value.trim(),
          contactPhone: phoneInput?.value.trim(),
          address: addressInput?.value.trim(),
          qrCodeUrl: qrInput?.value.trim(),
          openingHours: openingHours
        }
      });
      
      const updatedShop = result.shop || {};
      updatedShop.opening_hours = openingHours;
      updatedShop.openingHours = openingHours;
      renderInfo(updatedShop);
      
      info.opening_hours = openingHours;
      info.openingHours = openingHours;
      
      showFieldFeedback("settings-feedback", "门店设置已保存。");
      closePanel();
    } catch (error) {
      showFieldFeedback("settings-feedback", error.message, true);
    }
  });
}

export default async function init() {
  await initMerchantSettings();
}
