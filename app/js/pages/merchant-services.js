import { ensureMerchantSession } from "../utils/session.js";
import { apiRequest } from "../utils/api.js";
import { formatCurrency, formatAmountInputValue, parseAmountInputValue, bindAmountInputNormalization } from "../utils/format.js";
import { showFieldFeedback, renderFallback } from "../utils/dom.js";

const SERVICE_IMAGES = [
  "https://lh3.googleusercontent.com/aida-public/AB6AXuAW55lPtzTiFS8PaC4WGdSpSNyZ28yqlUA4UvX5m6_rFPKkgYNaqUadp5PZI6fU5asskbvbrLJNwzx3sy3jBaxbenAmPPRfNm7n3bEOw2X9dz4s9SfGMgAGhnW7H5iztow9ExLtPbQO4nfiKOz8-QOAk5tW7zvC9tlaaOFf7ZP12qUYa3y17dUVk7IRnmOmElS0Y9t3w2rT9GdLqZ7Ph7p3QvutvKFQWNUDj0kWN4lcwJy_r3EvUtNU8ZSmoSmKaCJVnH_P5PVj0txM",
  "icon-water",
  "icon-fitness",
  "https://lh3.googleusercontent.com/aida-public/AB6AXuDZ2I8QJvKUBZujTzxI-CW1jKohX9j9LfsRsH3_UCEvf1mW-YM5r4pCmWRR1muRvMFgWly9YVvn6GBHUAO_ER3tKi8I1ye2sp-GOIx6oX5jJVtrj0HHTN11jAvHl0Epb21HaHS628VVgKIrJPimdb4d5dAcbh4Q0_3CWD3ifBw5v1EH92c5TUkgb_bb2471ZO2xZtPgIJtqwm-RnZG4QV1mFWw53-eWV5jyxaSDcbmYae2gujo_-USgBk5JmZd7jOo_9Z2S6B53YSHx",
  "icon-spa",
  "icon-hot_tub"
];

function getBadge(serviceItem, index) {
  if (index === 0) return { label: "RECOMMENDED", tone: "gold" };
  if (index === 1) return { label: "PREMIUM", tone: "green" };
  if (index === 2) return { label: "VITALITY", tone: "orange" };
  if (index === 3) return { label: "MASTER SCALE", tone: "gray" };
  return null;
}

function renderThumb(source) {
  if (source.startsWith("icon-")) {
    return `<span class="material-symbols-outlined">${source.replace("icon-", "")}</span>`;
  }
  return `<img src="${source}" alt="项目缩略图" />`;
}

export async function initMerchantServices() {
  const session = ensureMerchantSession();
  const headers = {
    "x-shop-id": session.shopId,
    "x-user-id": session.user.id
  };
  const data = await apiRequest(`/merchant/service-items?shopId=${session.shopId}`, { headers });
  const serviceItems = data.serviceItems || [];
  const list = document.getElementById("service-list");
  const backdrop = document.getElementById("service-sheet-backdrop");
  const panel = document.getElementById("service-edit-panel");
  const title = document.getElementById("service-sheet-title");
  const nameInput = document.getElementById("service-item-name-input");
  const modeInput = document.getElementById("service-item-mode-input");
  const priceInput = document.getElementById("service-item-price-input");
  const durationInput = document.getElementById("service-item-duration-input");
  const descriptionInput = document.getElementById("service-item-description-input");
  let editingId = null;

  bindAmountInputNormalization(priceInput);

  function closePanel() {
    panel.hidden = true;
    backdrop.hidden = true;
  }

  function openPanel(item = null) {
    editingId = item?.id || null;
    title.textContent = item ? "编辑项目" : "新增项目";
    nameInput.value = item?.name || "";
    modeInput.value = item?.service_mode || "scheduled";
    priceInput.value = item ? formatAmountInputValue(item.list_price || 0) : "";
    durationInput.value = item?.duration_minutes ? String(item.duration_minutes) : "";
    descriptionInput.value = item?.description || "";
    document.getElementById("service-item-edit-actions").hidden = !item;
    document.getElementById("service-item-create-button").hidden = !!item;
    panel.hidden = false;
    backdrop.hidden = false;
  }

  function renderServices() {
    if (!serviceItems.length) {
      renderFallback(list, "当前还没有服务项目。");
      return;
    }
    list.innerHTML = serviceItems.map((item, index) => {
      const badge = getBadge(item, index);
      return `
        <article class="merchant-service-card">
          <div class="merchant-service-thumb">${renderThumb(SERVICE_IMAGES[index % SERVICE_IMAGES.length])}</div>
          <div class="merchant-service-copy-block">
            <h3>${item.name}</h3>
            <div class="merchant-service-tags">
              ${badge ? `<span class="merchant-service-badge ${badge.tone}">${badge.label}</span>` : ""}
            </div>
            <div class="merchant-service-meta">
              <span class="material-symbols-outlined">schedule</span>
              <span>${item.duration_minutes} 分钟</span>
            </div>
            <div class="merchant-service-desc">${item.description || "暂无项目说明"}</div>
          </div>
          <div class="merchant-service-side">
            <div class="merchant-service-price">${formatCurrency(item.list_price)}</div>
            <button class="merchant-edit-button" type="button" data-service-edit="${item.id}">编辑</button>
          </div>
        </article>
      `;
    }).join("");

    list.querySelectorAll("[data-service-edit]").forEach((button) => {
      button.addEventListener("click", () => {
        const item = serviceItems.find((entry) => entry.id === button.dataset.serviceEdit);
        if (item) openPanel(item);
      });
    });
  }

  document.getElementById("service-create-toggle")?.addEventListener("click", () => openPanel());
  document.getElementById("service-edit-close")?.addEventListener("click", closePanel);
  backdrop?.addEventListener("click", closePanel);

  document.getElementById("service-item-toggle-button")?.addEventListener("click", async () => {
    if (!editingId) return;
    const item = serviceItems.find((entry) => entry.id === editingId);
    if (!item) return;
    
    if (!confirm(`确定要删除项目「${item.name}」吗？此操作不可撤销。`)) {
      return;
    }
    
    try {
      await apiRequest(`/merchant/service-items/${editingId}?shopId=${session.shopId}`, {
        method: "DELETE",
        headers
      });
      const index = serviceItems.findIndex((entry) => entry.id === editingId);
      if (index > -1) {
        serviceItems.splice(index, 1);
      }
      renderServices();
      closePanel();
    } catch (error) {
      showFieldFeedback("service-item-feedback", error.message, true);
    }
  });

  document.getElementById("service-item-save-button")?.addEventListener("click", async () => {
    if (!editingId) return;
    try {
      showFieldFeedback("service-item-feedback", "");
      const body = {
        name: nameInput.value.trim(),
        description: descriptionInput.value.trim(),
        serviceMode: modeInput.value,
        listPrice: parseAmountInputValue(priceInput.value),
        durationMinutes: Number(durationInput.value || 0)
      };
      const result = await apiRequest(`/merchant/service-items/${editingId}?shopId=${session.shopId}`, { method: "PATCH", headers, body });
      const target = serviceItems.find((entry) => entry.id === editingId);
      if (target) Object.assign(target, result.serviceItem || {});
      renderServices();
      closePanel();
    } catch (error) {
      showFieldFeedback("service-item-feedback", error.message, true);
    }
  });

  document.getElementById("service-item-create-button")?.addEventListener("click", async () => {
    try {
      showFieldFeedback("service-item-feedback", "");
      const body = {
        name: nameInput.value.trim(),
        description: descriptionInput.value.trim(),
        serviceMode: modeInput.value,
        listPrice: parseAmountInputValue(priceInput.value),
        durationMinutes: Number(durationInput.value || 0)
      };
      const result = await apiRequest(`/merchant/service-items?shopId=${session.shopId}`, { method: "POST", headers, body });
      if (result.serviceItem) {
        serviceItems.unshift(result.serviceItem);
      }
      renderServices();
      closePanel();
    } catch (error) {
      showFieldFeedback("service-item-feedback", error.message, true);
    }
  });

  renderServices();
}

export default async function init() {
  await initMerchantServices();
}
