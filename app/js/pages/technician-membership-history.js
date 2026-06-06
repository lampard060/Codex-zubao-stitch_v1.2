import { initIconFallback } from "../utils/icon-fallback.js";
import { initBrandingAssets } from "../utils/branding.js";
import { apiRequest } from "../utils/api.js";
import { ensureTechnicianSession } from "../utils/session.js";
import { registerTechnicianServiceWorker } from "../utils/pwa.js";
import { getTechnicianMembershipStatus, renderBottomNav, renderTopbar } from "../utils/technician-shared.js?v=20260515-redesign";

const PREVIEW_HISTORY = [
  {
    id: "current-shop",
    shop_name: "御足堂",
    shop_address: "东营港经济开发区",
    shop_opening_hours: "12:00-04:00",
    shop_contact_phone: "13256320254",
    shop_manager_name: "孔凡红",
    membership_status: "active",
    joined_at: "2026-04-18T10:30:00+08:00",
    left_at: null
  },
  {
    id: "history-shop-1",
    shop_name: "澜亭养生会馆",
    shop_address: "东营市东城府前大街 128 号",
    shop_opening_hours: "11:00-02:00",
    shop_contact_phone: "18600001234",
    shop_manager_name: "赵经理",
    membership_status: "left",
    joined_at: "2025-08-06T09:00:00+08:00",
    left_at: "2026-03-28T21:30:00+08:00"
  },
  {
    id: "history-shop-2",
    shop_name: "云栖足道",
    shop_address: "东营市西城济南路 66 号",
    shop_opening_hours: "10:00-01:00",
    shop_contact_phone: "18577778888",
    shop_manager_name: "孙店长",
    membership_status: "left",
    joined_at: "2024-11-12T13:00:00+08:00",
    left_at: "2025-07-30T19:00:00+08:00"
  }
];

async function init() {
  initIconFallback();
  initBrandingAssets();
  registerTechnicianServiceWorker();
  renderTopbar({ title: "历史签约店铺", showBack: true });
  const topbarTitle = document.querySelector("#technician-topbar .tech-topbar-title");
  if (topbarTitle) {
    topbarTitle.textContent = "服务历史";
  }
  renderBottomNav("profile", true);

  let isSigned = false;
  try {
    const membership = await getTechnicianMembershipStatus();
    isSigned = membership.isSigned;
  } catch (error) {
    console.warn("获取技师签约状态失败:", error);
  }

  renderBottomNav("profile", isSigned);

  if (isPreviewMode()) {
    renderMembershipHistory(PREVIEW_HISTORY);
    return;
  }

  try {
    const session = ensureTechnicianSession();
    const technicianId = session.technicianUserId || session.user.id;
    const data = await apiRequest(`/technician/membership?technicianUserId=${technicianId}`);
    renderMembershipHistory(Array.isArray(data.membershipHistory) ? data.membershipHistory : []);
  } catch (error) {
    console.warn("加载历史签约门店失败，回退预览数据:", error);
    renderMembershipHistory(PREVIEW_HISTORY);
  }
}

function renderMembershipHistory(history) {
  const totalShopsEl = document.getElementById("membership-total-shops");
  const currentStatusEl = document.getElementById("membership-current-status");
  const latestDateEl = document.getElementById("membership-latest-date");
  const countEl = document.getElementById("membership-history-count");
  const listEl = document.getElementById("membership-history-list");

  const rows = Array.isArray(history) ? history : [];
  const currentMembership = rows.find((item) => item.membership_status === "active") || null;

  if (totalShopsEl) totalShopsEl.textContent = String(rows.length);
  if (currentStatusEl) currentStatusEl.textContent = currentMembership ? "签约中" : "未签约";
  if (latestDateEl) {
    latestDateEl.textContent = currentMembership
      ? `签约于 ${formatDate(currentMembership.joined_at)}`
      : rows.length
        ? `最近解约 ${formatDate(rows[0].left_at || rows[0].joined_at)}`
        : "暂无记录";
  }
  if (countEl) countEl.textContent = `${rows.length} 条记录`;

  if (!listEl) return;

  if (!rows.length) {
    listEl.innerHTML = `
      <div class="upcoming-empty-card">
        <div class="upcoming-empty-icon"><span class="material-symbols-outlined">storefront</span></div>
        <p class="upcoming-empty-title">还没有签约门店记录</p>
        <p class="upcoming-empty-desc">后续签约或解约过的门店，都会沉淀在这里。</p>
      </div>
    `;
    return;
  }

  listEl.innerHTML = rows.map((item, index) => {
    const isActive = item.membership_status === "active";
    const joinedText = formatDate(item.joined_at);
    const leftText = item.left_at ? formatDate(item.left_at) : "";
    return `
      <article class="membership-history-card ${isActive ? "is-active" : ""}">
        <div class="membership-history-card-head">
          <div>
            <div class="membership-history-step">${String(index + 1).padStart(2, "0")}</div>
            <h3>${escapeHtml(item.shop_name || "未命名门店")}</h3>
          </div>
          <span class="membership-status-pill ${isActive ? "is-active" : "is-left"}">${isActive ? "签约中" : "已解约"}</span>
        </div>

        <div class="membership-history-meta">
          <div class="membership-history-meta-item">
            <span class="material-symbols-outlined">location_on</span>
            <span>${escapeHtml(item.shop_address || "地址未填写")}</span>
          </div>
          <div class="membership-history-meta-item">
            <span class="material-symbols-outlined">person</span>
            <span>负责人：${escapeHtml(item.shop_manager_name || "未填写")}</span>
          </div>
          <div class="membership-history-meta-item">
            <span class="material-symbols-outlined">call</span>
            <span>${escapeHtml(item.shop_contact_phone || "未填写")}</span>
          </div>
          <div class="membership-history-meta-item">
            <span class="material-symbols-outlined">schedule</span>
            <span>营业时间：${escapeHtml(item.shop_opening_hours || "未填写")}</span>
          </div>
        </div>

        <div class="membership-history-timeline">
          <div class="membership-history-timeline-item">
            <span class="membership-history-timeline-label">签约时间</span>
            <strong>${joinedText}</strong>
          </div>
          <div class="membership-history-timeline-item">
            <span class="membership-history-timeline-label">${isActive ? "当前状态" : "解约时间"}</span>
            <strong>${isActive ? "合作进行中" : leftText || "待确认"}</strong>
          </div>
        </div>
      </article>
    `;
  }).join("");
}

function formatDate(value) {
  if (!value) return "未记录";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "未记录";
  return date.toLocaleDateString("zh-CN", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit"
  });
}

function escapeHtml(value) {
  return String(value || "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll("\"", "&quot;")
    .replaceAll("'", "&#39;");
}

function isPreviewMode() {
  return new URLSearchParams(window.location.search).get("preview") === "1";
}

init();

export default init;
