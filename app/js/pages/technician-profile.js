import { initIconFallback } from "../utils/icon-fallback.js";
import { initBrandingAssets } from "../utils/branding.js";
import { apiRequest } from "../utils/api.js";
import { ensureTechnicianSession } from "../utils/session.js";
import { registerTechnicianServiceWorker } from "../utils/pwa.js";
import { getTechnicianMembershipStatus, renderBottomNav, renderTopbar, logout, formatNumber, safeAvatarUrl } from "../utils/technician-shared.js?v=20260515-redesign";

let isSigned = false;
let membershipData = null;

async function init() {
  initIconFallback();
  initBrandingAssets();
  registerTechnicianServiceWorker();
  renderTopbar({ title: "足宝", showBack: true, showSettings: true });
  renderBottomNav("profile", true);

  try {
    ensureTechnicianSession();
  } catch (e) {
    console.warn("缺少技师登录状态，已保留资料页静态预览:", e);
    const shopCard = document.getElementById("shop-card");
    if (shopCard) shopCard.classList.remove("hidden");
    bindEvents();
    return;
  }

  try {
    const membership = await getTechnicianMembershipStatus();
    isSigned = membership.isSigned;
    membershipData = membership.membership;
  } catch (e) {
    console.warn("获取签约状态失败:", e);
  }

  renderBottomNav("profile", isSigned);

  const shopCard = document.getElementById("shop-card");
  if (shopCard) {
    shopCard.classList.toggle("hidden", !isSigned);
  }

  if (isPreviewMode()) {
    fitProfileShopLines();
    bindEvents();
    return;
  }

  await loadProfile();
  bindEvents();
}

async function loadProfile() {
  try {
    const session = ensureTechnicianSession();
    const technicianId = session.technicianUserId || session.user.id;
    const [profileRes, homeRes] = await Promise.all([
      apiRequest(`/technician/profile?technicianUserId=${technicianId}`),
      apiRequest(`/technician/home?technicianUserId=${technicianId}`).catch(() => null)
    ]);

    const data = profileRes?.profile || profileRes || {};

    const nameEl = document.getElementById("profile-name");
    if (nameEl && data.name) nameEl.textContent = data.name;

    const bioEl = document.getElementById("profile-bio");
    if (bioEl && data.bio) bioEl.textContent = data.bio;

    const avatarEl = document.getElementById("profile-avatar");
    if (avatarEl && data.avatar_url) avatarEl.src = safeAvatarUrl(data.avatar_url);

    const topbarAvatarEl = document.getElementById("topbar-avatar");
    if (topbarAvatarEl && data.avatar_url) topbarAvatarEl.src = safeAvatarUrl(data.avatar_url);

    const numberEl = document.getElementById("profile-number");
    if (numberEl && data.employee_no) numberEl.textContent = `ID: ${data.employee_no}`;

    const statHoursEl = document.getElementById("stat-hours");
    const statLabelEl = document.getElementById("stat-primary-label");
    const statUnitEl = document.getElementById("stat-primary-unit");
    if (statHoursEl) {
      const completedOrders = homeRes?.monthSummary?.completed_order_count ?? 1248;
      statHoursEl.textContent = formatNumber(completedOrders);
    }
    if (statLabelEl) statLabelEl.textContent = "累计完成";
    if (statUnitEl) statUnitEl.textContent = "单";

    const ratingEl = document.getElementById("stat-rating");
    if (ratingEl && data.rating) {
      ratingEl.textContent = data.rating;
    }
    const ratingChipEl = document.getElementById("profile-rating-chip");
    if (ratingChipEl && data.rating) {
      ratingChipEl.textContent = data.rating;
    }

    if (isSigned && membershipData) {
      const shopNameEl = document.getElementById("shop-name");
      if (shopNameEl) shopNameEl.textContent = membershipData.shop_name || "门店";

      const shopAreaEl = document.getElementById("shop-area");
      if (shopAreaEl) {
        shopAreaEl.innerHTML = `
          <svg viewBox="0 0 24 24" width="22px" height="22px" fill="rgb(242, 202, 80)" aria-hidden="true" class="material-symbols-svg" style="display: inline-block; vertical-align: middle; flex-shrink: 0;"><path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5c-1.38 0-2.5-1.12-2.5-2.5s1.12-2.5 2.5-2.5 2.5 1.12 2.5 2.5-1.12 2.5-2.5 2.5z"></path></svg>
          <span>${membershipData.shop_address || "地址未填写"}</span>
        `;
      }

      const shopScheduleEl = document.getElementById("shop-schedule");
      if (shopScheduleEl) {
        const openingHours = membershipData.shop_opening_hours || "10:00-20:00";
        shopScheduleEl.innerHTML = `
          <svg viewBox="0 0 24 24" width="22px" height="22px" fill="rgb(242, 202, 80)" aria-hidden="true" class="material-symbols-svg" style="display: inline-block; vertical-align: middle; flex-shrink: 0;"><path d="M11.99 2C6.47 2 2 6.48 2 12s4.47 10 9.99 10C17.52 22 22 17.52 22 12S17.52 2 11.99 2zM12 20c-4.42 0-8-3.58-8-8s3.58-8 8-8 8 3.58 8 8-3.58 8-8 8zm.5-13H11v6l5.25 3.15.75-1.23-4.5-2.67z"></path></svg>
          <span>营业时间：${openingHours}</span>
        `;
      }

      fitProfileShopLines();
    }
  } catch (e) {
    console.warn("加载个人资料失败:", e);
  }
}

async function handleTerminate() {
  if (membershipData?.leave_application_status === "pending") {
    alert("您已提交解约申请，正在等待门店审核。");
    return;
  }

  if (!confirm("确定要申请解约吗？\n\n解约后将无法继续接单，且需要重新申请才能加入其他门店。")) {
    return;
  }

  const reason = prompt("请输入解约原因（可选）:");

  try {
    const session = ensureTechnicianSession();
    const technicianId = session.technicianUserId || session.user.id;

    await apiRequest("/technician/membership/leave", {
      method: "POST",
      body: {
        technicianUserId: technicianId,
        reason: reason || undefined
      }
    });

    alert("解约申请已提交，等待签约门店审核。审核通过后您将恢复为未签约状态。");
    window.location.reload();
  } catch (e) {
    console.error("解约失败:", e);
    alert(`解约失败: ${e.message || "请重试"}`);
  }
}

function bindEvents() {
  const profileAvatar = document.getElementById("profile-avatar");
  const topbarAvatar = document.getElementById("topbar-avatar");
  [profileAvatar, topbarAvatar].forEach((img) => {
    if (!img) return;
    img.addEventListener("error", () => {
      img.src = "./zubao-tech-icon.png";
    }, { once: true });
  });

  // 设置弹窗
  const settingsModal = document.getElementById("settings-modal");
  const modalCloseBtn = document.getElementById("modal-close-btn");
  const modalEditProfile = document.getElementById("modal-edit-profile");
  const modalLogout = document.getElementById("modal-logout");

  function openModal() {
    if (settingsModal) {
      settingsModal.classList.add("active");
      document.body.style.overflow = "hidden";
    }
  }

  function closeModal() {
    if (settingsModal) {
      settingsModal.classList.remove("active");
      document.body.style.overflow = "";
    }
  }

  // 点击遮罩关闭弹窗
  if (settingsModal) {
    settingsModal.addEventListener("click", (e) => {
      if (e.target === settingsModal) {
        closeModal();
      }
    });
  }

  if (modalCloseBtn) {
    modalCloseBtn.addEventListener("click", closeModal);
  }

  if (modalEditProfile) {
    modalEditProfile.addEventListener("click", () => {
      closeModal();
      openEditModal();
    });
  }

  if (modalLogout) {
    modalLogout.addEventListener("click", () => {
      closeModal();
      if (confirm("确定要退出登录吗？")) {
        logout();
      }
    });
  }

  // 资料编辑弹窗
  const editProfileModal = document.getElementById("edit-profile-modal");
  const editModalCloseBtn = document.getElementById("edit-modal-close-btn");
  const editCancelBtn = document.getElementById("edit-cancel-btn");
  const editProfileForm = document.getElementById("edit-profile-form");
  const changeAvatarBtn = document.getElementById("change-avatar-btn");

  function openEditModal() {
    if (editProfileModal) {
      editProfileModal.classList.add("active");
      document.body.style.overflow = "hidden";
      // 加载当前资料
      const nameEl = document.getElementById("profile-name");
      const bioEl = document.getElementById("profile-bio");
      const editNameInput = document.getElementById("edit-name");
      const editBioInput = document.getElementById("edit-bio");
      const editGenderInput = document.getElementById("edit-gender");
      const editBirthdayInput = document.getElementById("edit-birthday");
      const editPhoneInput = document.getElementById("edit-phone");
      const editSkillsInput = document.getElementById("edit-skills");

      if (nameEl && editNameInput) editNameInput.value = nameEl.textContent;
      if (bioEl && editBioInput) editBioInput.value = bioEl.textContent;

      // 加载其他字段（如果有存储的数据）
      const storedProfile = JSON.parse(localStorage.getItem("technician_profile") || "{}");
      if (editGenderInput && storedProfile.gender) editGenderInput.value = storedProfile.gender;
      if (editBirthdayInput && storedProfile.birthday) editBirthdayInput.value = storedProfile.birthday;
      if (editPhoneInput && storedProfile.phone) editPhoneInput.value = storedProfile.phone;
      if (editSkillsInput && storedProfile.skills) editSkillsInput.value = storedProfile.skills;
    }
  }

  function closeEditModal() {
    if (editProfileModal) {
      editProfileModal.classList.remove("active");
      document.body.style.overflow = "";
    }
  }

  if (editProfileModal) {
    editProfileModal.addEventListener("click", (e) => {
      if (e.target === editProfileModal) {
        closeEditModal();
      }
    });
  }

  if (editModalCloseBtn) {
    editModalCloseBtn.addEventListener("click", closeEditModal);
  }

  if (editCancelBtn) {
    editCancelBtn.addEventListener("click", closeEditModal);
  }

  if (changeAvatarBtn) {
    changeAvatarBtn.addEventListener("click", () => {
      alert("头像上传功能开发中...");
    });
  }

  if (editProfileForm) {
    editProfileForm.addEventListener("submit", async (e) => {
      e.preventDefault();
      const formData = new FormData(editProfileForm);
      const profileData = {
        name: formData.get("name"),
        bio: formData.get("bio"),
        gender: formData.get("gender"),
        birthday: formData.get("birthday"),
        phone: formData.get("phone"),
        skills: formData.get("skills")
      };

      // 保存到本地存储
      localStorage.setItem("technician_profile", JSON.stringify(profileData));

      try {
        const session = ensureTechnicianSession();
        const technicianId = session.technicianUserId || session.user.id;
        await apiRequest("/technician/profile", {
          method: "PUT",
          body: JSON.stringify({
            technicianUserId: technicianId,
            ...profileData
          })
        });

        // 更新页面显示
        const nameEl = document.getElementById("profile-name");
        const bioEl = document.getElementById("profile-bio");
        if (nameEl) nameEl.textContent = profileData.name;
        if (bioEl) bioEl.textContent = profileData.bio;

        closeEditModal();
        alert("资料更新成功！");
      } catch (err) {
        console.error("更新资料失败:", err);
        // 即使API失败，本地数据已保存
        const nameEl = document.getElementById("profile-name");
        const bioEl = document.getElementById("profile-bio");
        if (nameEl) nameEl.textContent = profileData.name;
        if (bioEl) bioEl.textContent = profileData.bio;
        closeEditModal();
        alert("资料已保存（本地模式）");
      }
    });
  }

  document.body.addEventListener("click", (e) => {
    const target = e.target.closest("[id]");
    if (!target) return;

    switch (target.id) {
      case "settings-btn":
        openModal();
        break;
      case "notification-btn":
        alert("通知功能开发中...");
        break;
      case "avatar-edit-btn":
      case "edit-profile-btn":
        openEditModal();
        break;
      case "terminate-btn":
        handleTerminate();
        break;
      case "shop-detail-btn":
        showShopDetail();
        break;
      case "shop-leave-btn":
        handleTerminate();
        break;
      case "logout-btn":
        e.preventDefault();
        e.stopPropagation();
        if (confirm("确定要退出登录吗？")) {
          logout();
        }
        break;
      default:
        break;
    }
  });

  window.addEventListener("resize", fitProfileShopLines);
}

init();

function isPreviewMode() {
  return new URLSearchParams(window.location.search).get("preview") === "1";
}

function fitProfileShopLines() {
  window.requestAnimationFrame(() => {
    fitLine(document.getElementById("shop-area"), 14, 14);
    fitLine(document.getElementById("shop-schedule"), 14, 14);
  });
}

function fitLine(container, maxSize, minSize) {
  if (!container) return;
  const textEl = container.querySelector("span:last-child") || container;

  textEl.style.fontSize = `${maxSize}px`;
  let fontSize = maxSize;
  const iconEl = container.querySelector("svg, .material-symbols-outlined");
  const gap = Number.parseFloat(window.getComputedStyle(container).gap || "0");
  const reservedWidth = (iconEl?.getBoundingClientRect().width || 0) + gap;
  const availableWidth = Math.max(0, container.clientWidth - reservedWidth);

  while (fontSize > minSize && textEl.scrollWidth > availableWidth) {
    fontSize -= 1;
    textEl.style.fontSize = `${fontSize}px`;
  }
}

function formatTime(timeStr) {
  if (!timeStr) return "";
  const [hours, minutes] = timeStr.split(":");
  const h = parseInt(hours, 10);
  const m = parseInt(minutes, 10);
  const period = h >= 12 ? "PM" : "AM";
  const displayH = h > 12 ? h - 12 : (h === 0 ? 12 : h);
  return `${displayH}:${m.toString().padStart(2, "0")} ${period}`;
}

async function showShopDetail() {
  if (!membershipData || !membershipData.shop_id) {
    alert("门店信息加载中，请稍后重试");
    return;
  }

  try {
    const data = await apiRequest(`/technician/shop/${membershipData.shop_id}/detail`);
    const shop = data.shop;

    const planMap = {
      trial: "体验版",
      basic: "基础版",
      professional: "专业版",
      enterprise: "企业版"
    };
    const planName = planMap[shop.subscription_plan] || shop.subscription_plan || "未设置";
    const statusMap = { active: "已激活", expired: "已过期", suspended: "已暂停", trial: "试用中" };
    const statusName = statusMap[shop.subscription_status] || shop.subscription_status || "未知";
    const hasPendingLeave = membershipData?.leave_application_status === "pending";
    const leaveButtonText = hasPendingLeave ? "解约申请审核中" : "申请解约";
    const leaveHint = hasPendingLeave
      ? "已提交解约申请，等待签约门店审核。审核通过后将恢复为未签约状态。"
      : "如需退出当前签约门店，可发起解约申请，由门店审核通过后生效。";
    let expiresText = "未设置";
    if (shop.subscription_expires_at) {
      expiresText = new Date(shop.subscription_expires_at).toLocaleDateString("zh-CN", { year: "numeric", month: "2-digit", day: "2-digit" });
    }

    const modalHtml = `
      <div class="shop-detail-modal" id="shop-detail-modal">
        <div class="shop-detail-backdrop" onclick="this.parentElement.remove()"></div>
        <div class="shop-detail-content">
          <div class="shop-detail-header">
            <h2>${shop.name}</h2>
            <button class="shop-detail-close" onclick="this.closest('.shop-detail-modal').remove()">
              <span class="material-symbols-outlined">close</span>
            </button>
          </div>
          <div class="shop-detail-body">
            <div class="shop-detail-section-title">基本信息</div>
            <div class="shop-detail-row">
              <span class="material-symbols-outlined">location_on</span>
              <span>${shop.address || "地址未填写"}</span>
            </div>
            <div class="shop-detail-row">
              <span class="material-symbols-outlined">person</span>
              <span>负责人：${shop.manager_name || "未设置"}</span>
            </div>
            <div class="shop-detail-row">
              <span class="material-symbols-outlined">phone</span>
              <span>${shop.contact_phone || "未设置"}</span>
            </div>
            <div class="shop-detail-row">
              <span class="material-symbols-outlined">schedule</span>
              <span>营业时间：${shop.opening_hours || "未设置"}</span>
            </div>
            <div class="shop-detail-section-title">运营数据</div>
            <div class="shop-detail-row">
              <span class="material-symbols-outlined">groups</span>
              <span>在岗技师：${shop.technician_count || 0} 人</span>
            </div>
            <div class="shop-detail-row">
              <span class="material-symbols-outlined">spa</span>
              <span>服务项目：${shop.service_count || 0} 个</span>
            </div>
            <div class="shop-detail-row">
              <span class="material-symbols-outlined">meeting_room</span>
              <span>可用房间：${shop.room_count || 0} 间</span>
            </div>
            <div class="shop-detail-section-title">订阅信息</div>
            <div class="shop-detail-row">
              <span class="material-symbols-outlined">stars</span>
              <span>订阅计划：${planName}</span>
            </div>
            <div class="shop-detail-row">
              <span class="material-symbols-outlined">check_circle</span>
              <span>订阅状态：${statusName}</span>
            </div>
            <div class="shop-detail-row">
              <span class="material-symbols-outlined">event</span>
              <span>到期时间：${expiresText}</span>
            </div>
            <div class="shop-detail-footer">
              <p class="shop-detail-footer-copy">${leaveHint}</p>
              <button class="tech-primary-button" id="shop-leave-btn" type="button" ${hasPendingLeave ? "disabled" : ""}>
                ${leaveButtonText}
              </button>
            </div>
          </div>
        </div>
      </div>
    `;

    document.body.insertAdjacentHTML("beforeend", modalHtml);
  } catch (e) {
    console.error("加载门店详情失败:", e);
    alert(`加载失败: ${e.message || "请重试"}`);
  }
}
