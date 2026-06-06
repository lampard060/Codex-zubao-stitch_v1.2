import { initIconFallback } from "../utils/icon-fallback.js";
import { initBrandingAssets } from "../utils/branding.js";
import { apiRequest } from "../utils/api.js";
import { ensureTechnicianSession } from "../utils/session.js";
import { registerTechnicianServiceWorker } from "../utils/pwa.js";
import { getTechnicianMembershipStatus, renderBottomNav, renderApplyTopbar } from "../utils/technician-shared.js?v=20260515-redesign";

let shopsCache = [];
let applicationsCache = [];

const MOCK_SHOPS = [
  {
    id: "shop-1",
    name: "Zenith Wellness Spa",
    address: "1.2 miles • Downtown",
    tags: ["精选服务", "按摩", "皮肤管理"],
    technician_count: 12,
    image_url: "https://lh3.googleusercontent.com/aida-public/AB6AXuCZcR5PQDQg4NFqYOdUXw5q05yqMg9jsJ9b-nOx1fpiMUukiwZ5n-lUdGBNRgwQJ7sQazw2qbq1TsHDEvpwaPD3MPYJQwaFyqV295VkplaaHOLXWJKfrJzk2v7Zvp7xvXc4Wga5kpwlOPnmybHKYlb_hNo70D2jgCEJT4eHsUNZDKSxp_4rWv6zLpo66dUWJ_91MbN-6bqQy9zmjAYnAUwUQZHrwcoUuDdQRc6BmouSGAl8EXzYMTFegu4Yf7b75OoYaQUrzP-93q4O"
  },
  {
    id: "shop-2",
    name: "Aura Sanctuary",
    address: "3.5 miles • Westside",
    tags: ["高端护理", "理疗"],
    technician_count: 8,
    image_url: "https://lh3.googleusercontent.com/aida-public/AB6AXuB0QhfIoJXiNtaEPSYHqSec3xc7BJkWaS8wfcVbAJt2mwQfpLX4cpYgh-Y4AcEvJcMtC-C78xONOZfQnkIDXBmetUA0UdxbDC152M_mPYC4FndzoEZMqiKhJ0N48ElbX0rA8wFZPrdRwi5yk32ts5jY17CGLDfpowsDQoSUKFbaZlq_6GGFm-1Z1jZc9U3eC_ekCCNt-FomM48UJsPhL5odjgmyptDZgMrYolNTgpKE12FTWIWejhsXYNKc0L4UGDCB9F0EV_f_hvNs"
  }
];

async function init() {
  initIconFallback();
  initBrandingAssets();
  registerTechnicianServiceWorker();
  renderApplyTopbar("未签约");
  renderBottomNav("apply", false);

  try {
    ensureTechnicianSession();
  } catch (e) {
    console.warn("缺少技师登录状态，已保留申请页静态预览:", e);
    renderShopList(MOCK_SHOPS);
    bindEvents();
    return;
  }

  let isSigned = false;
  try {
    const membership = await getTechnicianMembershipStatus();
    isSigned = membership.isSigned;
  } catch (e) {
    console.warn("获取签约状态失败:", e);
  }

  if (isSigned) {
    window.location.href = "./technician-home.html";
    return;
  }

  if (isPreviewMode()) {
    renderShopList(MOCK_SHOPS);
    bindEvents();
    return;
  }

  await loadApplications();
  await loadShops();
  bindEvents();
}

async function loadApplications() {
  try {
    const data = await apiRequest("/technician/applications");
    applicationsCache = data.applications || [];
    renderApplications();
  } catch (e) {
    console.warn("加载申请列表失败:", e);
    applicationsCache = [];
  }
}

function renderApplications() {
  const section = document.getElementById("applications-section");
  const list = document.getElementById("applications-list");
  if (!section || !list) return;

  const activeApplications = applicationsCache.filter(app => app.status === "pending" || app.status === "rejected");

  if (!activeApplications.length) {
    section.style.display = "none";
    return;
  }

  section.style.display = "block";
  list.innerHTML = activeApplications.map(app => {
    const statusText = app.status === "pending" ? "审核中" : "审核未通过";
    const statusClass = app.status === "pending" ? "is-pending" : "is-rejected";
    const date = app.appliedAt ? new Date(app.appliedAt).toLocaleDateString("zh-CN") : "";

    return `
      <div class="join-application-card">
        <div class="join-application-info">
          <p class="join-application-shop">${escapeHtml(app.shopName)}</p>
          <div class="join-application-meta">
            <span>申请于 ${date}</span>
          </div>
        </div>
        <span class="join-application-status ${statusClass}">${statusText}</span>
      </div>
    `;
  }).join("");
}

function getApplicationStatusForShop(shopId) {
  const app = applicationsCache.find(a => a.shopId === shopId && a.status !== "approved");
  if (!app) return null;
  return app.status;
}

async function loadShops(keyword = "") {
  const container = document.getElementById("nearby-shops-list");
  if (!container) return;

  container.innerHTML = `
    <div class="upcoming-empty-card">
      <div class="upcoming-empty-icon"><span class="material-symbols-outlined">hourglass_top</span></div>
      <p class="upcoming-empty-title">正在加载店铺</p>
      <p class="upcoming-empty-desc">请稍候片刻。</p>
    </div>
  `;

  try {
    const session = ensureTechnicianSession();
    const technicianId = session.technicianUserId || session.user.id;
    const data = await apiRequest(`/technician/shops?technicianUserId=${technicianId}&q=${encodeURIComponent(keyword)}&limit=20`);
    shopsCache = data.shops || [];
    renderShopList(shopsCache.length ? shopsCache : filterMockShops(keyword));
  } catch (e) {
    console.warn("加载店铺列表失败，使用 mock 数据:", e);
    renderShopList(filterMockShops(keyword));
  }
}

function filterMockShops(keyword) {
  const normalized = String(keyword || "").trim().toLowerCase();
  if (!normalized) return MOCK_SHOPS;
  return MOCK_SHOPS.filter((shop) => shop.name.toLowerCase().includes(normalized));
}

function renderShopList(shops) {
  const container = document.getElementById("nearby-shops-list");
  if (!container) return;

  if (!shops.length) {
    container.innerHTML = `
      <div class="upcoming-empty-card">
        <div class="upcoming-empty-icon"><span class="material-symbols-outlined">search_off</span></div>
        <p class="upcoming-empty-title">未找到相关门店</p>
        <p class="upcoming-empty-desc">换个关键词试试看。</p>
      </div>
    `;
    return;
  }

  container.innerHTML = shops.map((shop, index) => {
    const appStatus = getApplicationStatusForShop(shop.id);
    let buttonState = "";
    let buttonText = "申请加入";

    if (appStatus === "pending") {
      buttonState = "is-pending is-disabled";
      buttonText = "已发送申请，等待审核";
    } else if (appStatus === "rejected") {
      buttonState = "is-rejected is-disabled";
      buttonText = "申请未通过";
    }

    return `
    <article class="join-shop-card ${index === 0 ? "is-featured" : ""}" data-shop-id="${shop.id}">
      <div class="join-shop-media" style="${shop.image_url ? `--shop-image:url('${escapeAttribute(shop.image_url)}')` : ""}"></div>
      <div class="join-shop-overlay">
        <div class="join-shop-top">
          <div>
            <h3 class="join-shop-name">${escapeHtml(shop.name)}</h3>
            <div class="join-shop-address">
              <span class="material-symbols-outlined">location_on</span>
              <span>${escapeHtml(shop.address || "地址未填写")}</span>
            </div>
          </div>
          <div class="join-shop-count">
            <span class="material-symbols-outlined">groups</span>
            <span>${shop.technician_count || 0} 位技师</span>
          </div>
        </div>
        <button class="join-shop-btn shop-join-btn ${buttonState}" data-shop-id="${shop.id}" type="button">${buttonText}</button>
      </div>
    </article>
  `;
  }).join("");

  container.querySelectorAll(".shop-join-btn:not(.is-disabled)").forEach((btn) => {
    btn.addEventListener("click", async (e) => {
      e.stopPropagation();
      await applyToShop(btn.dataset.shopId);
    });
  });
}

function escapeHtml(text) {
  if (!text) return "";
  const div = document.createElement("div");
  div.textContent = text;
  return div.innerHTML;
}

function escapeAttribute(text) {
  return String(text || "").replace(/'/g, "%27").replace(/"/g, "%22");
}

async function applyToShop(shopId) {
  try {
    const result = await apiRequest("/technician/shop-applications", {
      method: "POST",
      body: {
        shopId
      }
    });

    if (result.alreadyPending) {
      alert("您已经向该门店提交了申请，请耐心等待审核。");
    } else {
      alert("申请已提交，等待店长审核！");
    }

    await loadApplications();
    await loadShops();
  } catch (e) {
    console.error("申请加入门店失败:", e);
    alert(`申请失败: ${e.message || "请重试"}`);
  }
}

function bindEvents() {
  const scanBtn = document.getElementById("scan-qr-btn");
  if (scanBtn) {
    scanBtn.addEventListener("click", () => {
      const shopId = prompt("请输入门店邀请码（门店ID）:");
      if (shopId && shopId.trim()) {
        applyToShop(shopId.trim());
      }
    });
  }

  const searchInput = document.getElementById("shop-search-input");
  if (searchInput) {
    let debounceTimer = null;
    searchInput.addEventListener("input", (e) => {
      const keyword = e.target.value.trim();
      clearTimeout(debounceTimer);
      debounceTimer = setTimeout(() => {
        loadShops(keyword);
      }, 300);
    });
  }

  document.addEventListener("click", (e) => {
    if (e.target.closest("#notification-btn")) {
      alert("通知功能开发中...");
    }
  });
}

init();

function isPreviewMode() {
  return new URLSearchParams(window.location.search).get("preview") === "1";
}
