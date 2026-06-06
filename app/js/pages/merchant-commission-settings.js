import { ensureMerchantSession } from "../utils/session.js";
import { apiRequest } from "../utils/api.js";
import { formatCurrency, parseAmountInputValue, getInitial } from "../utils/format.js";

function formatInputValue(value) {
  if (value === undefined || value === null || value === "") return "";
  const num = Number(value);
  return num % 1 === 0 ? String(num) : num.toFixed(2);
}

export async function initMerchantCommissionSettings() {
  const session = ensureMerchantSession();
  const headers = {
    "x-shop-id": session.shopId,
    "x-user-id": session.user.id
  };

  document.getElementById("settings-back")?.addEventListener("click", () => {
    history.back();
  });

  try {
    const rulesData = await apiRequest(`/merchant/payroll/rules?shopId=${session.shopId}`, { headers });
    const defaultRule = rulesData.defaultRule || {};
    const overrideRules = rulesData.overrideRules || [];

    const baseSalaryInput = document.getElementById("commission-base-salary");
    const designatedBonusInput = document.getElementById("commission-designated-bonus");
    const scheduledRateInput = document.getElementById("commission-scheduled-rate");
    const designatedRateInput = document.getElementById("commission-designated-rate");

    if (baseSalaryInput) baseSalaryInput.value = formatInputValue(defaultRule.base_salary || 0);
    if (designatedBonusInput) designatedBonusInput.value = formatInputValue(defaultRule.designated_bonus_amount || 0);
    if (scheduledRateInput) scheduledRateInput.value = String(Number(defaultRule.scheduled_commission_rate || 0) * 100);
    if (designatedRateInput) designatedRateInput.value = String(Number(defaultRule.designated_commission_rate || 0) * 100);

    renderTechnicianRules(overrideRules, session, headers);
  } catch (error) {
    console.error("Failed to load rules:", error);
    showFeedback("加载提成规则失败", true);
  }

  document.getElementById("save-default-rule")?.addEventListener("click", async () => {
    const baseSalary = parseAmountInputValue(document.getElementById("commission-base-salary")?.value);
    const designatedBonus = parseAmountInputValue(document.getElementById("commission-designated-bonus")?.value);
    const scheduledRate = Number(document.getElementById("commission-scheduled-rate")?.value || 0) / 100;
    const designatedRate = Number(document.getElementById("commission-designated-rate")?.value || 0) / 100;

    const btn = document.getElementById("save-default-rule");
    btn.disabled = true;
    btn.textContent = "保存中...";

    try {
      await apiRequest(`/merchant/payroll/rules/default?shopId=${session.shopId}`, {
        method: "PUT",
        headers,
        body: {
          baseSalary,
          designatedBonusAmount: designatedBonus,
          scheduledCommissionRate: scheduledRate,
          designatedCommissionRate: designatedRate
        }
      });
      showFeedback("默认规则保存成功！");
    } catch (error) {
      showFeedback(error.message, true);
    } finally {
      btn.disabled = false;
      btn.textContent = "更新默认设置";
    }
  });

  document.getElementById("add-technician-rule")?.addEventListener("click", async () => {
    try {
      const techniciansData = await apiRequest(`/merchant/technicians?shopId=${session.shopId}`, { headers });
      const technicians = techniciansData.technicians || [];
      showTechnicianSelector(technicians, session, headers);
    } catch (error) {
      showFeedback("获取技师列表失败", true);
    }
  });


}

function showFeedback(message, isError = false) {
  const feedbackEl = document.getElementById("commission-feedback");
  if (feedbackEl) {
    feedbackEl.textContent = message;
    feedbackEl.className = "commission-feedback" + (isError ? " error" : "");
  }
}

function renderTechnicianRules(overrideRules, session, headers) {
  const container = document.getElementById("technician-rules-list");
  if (!container) return;

  if (!overrideRules || overrideRules.length === 0) {
    container.innerHTML = `
      <div class="commission-empty-state">
        <div class="commission-empty-icon">
          <span class="material-symbols-outlined">badge</span>
          <span class="commission-empty-badge">
            <span class="material-symbols-outlined">add_circle</span>
          </span>
        </div>
        <h3 class="commission-empty-title">暂无个别提成设置</h3>
        <p class="commission-empty-desc">所有技师目前都遵循门店默认规则。您可以为高级技师或特聘专家设置专属比例。</p>
      </div>
    `;
    return;
  }

  container.innerHTML = overrideRules.map(rule => `
    <div class="commission-technician-card" data-rule-id="${rule.id}" data-technician-id="${rule.technician_user_id}">
      <div class="commission-technician-header">
        <div class="commission-technician-avatar">
          ${rule.avatar_url 
            ? `<img src="${rule.avatar_url}" alt="${rule.name}">`
            : `<div style="width:100%;height:100%;display:flex;align-items:center;justify-content:center;background:#ddd;font-weight:800;color:#666;">${getInitial(rule.name)}</div>`
          }
        </div>
        <div class="commission-technician-info">
          <h4 class="commission-technician-name">${rule.name}</h4>
          <p class="commission-technician-meta">底薪 ${formatCurrency(rule.base_salary || 0)} · 生效中</p>
        </div>
        <div style="display:flex;gap:6px;align-items:center;">
          <button class="commission-technician-edit edit-rule-btn" data-technician-id="${rule.technician_user_id}" data-technician-name="${rule.name}">
            <span class="material-symbols-outlined">edit</span>
          </button>
          <button class="commission-technician-edit delete-rule-btn" data-technician-id="${rule.technician_user_id}" data-technician-name="${rule.name}" style="color:#e74c3c;">
            <span class="material-symbols-outlined">delete</span>
          </button>
        </div>
      </div>
      <div class="commission-technician-details">
        <div class="commission-technician-detail">
          <span class="commission-technician-detail-label">排钟提成</span>
          <span class="commission-technician-detail-value">${Number(rule.scheduled_commission_rate || 0) * 100}%</span>
        </div>
        <div class="commission-technician-detail">
          <span class="commission-technician-detail-label">点钟提成</span>
          <span class="commission-technician-detail-value">${Number(rule.designated_commission_rate || 0) * 100}%</span>
        </div>
      </div>
    </div>
  `).join("");

  container.querySelectorAll(".edit-rule-btn").forEach(btn => {
    btn.addEventListener("click", (e) => {
      e.stopPropagation();
      const technicianId = btn.dataset.technicianId;
      const technicianName = btn.dataset.technicianName;
      showTechnicianRuleEditor(technicianId, technicianName, session, headers);
    });
  });

  container.querySelectorAll(".delete-rule-btn").forEach(btn => {
    btn.addEventListener("click", async (e) => {
      e.stopPropagation();
      const technicianId = btn.dataset.technicianId;
      const technicianName = btn.dataset.technicianName;

      if (!confirm(`确定要删除 ${technicianName} 的单独提成规则吗？删除后将恢复使用门店默认规则。`)) {
        return;
      }

      btn.disabled = true;
      try {
        await apiRequest(`/merchant/payroll/rules/technicians/${technicianId}?shopId=${session.shopId}`, {
          method: "DELETE",
          headers
        });
        showFeedback(`${technicianName} 的单独规则已删除`);
        btn.closest(".commission-technician-card")?.remove();
        if (container.querySelectorAll(".commission-technician-card").length === 0) {
          container.innerHTML = `
            <div class="commission-empty-state">
              <div class="commission-empty-icon">
                <span class="material-symbols-outlined">badge</span>
                <span class="commission-empty-badge">
                  <span class="material-symbols-outlined">add_circle</span>
                </span>
              </div>
              <h3 class="commission-empty-title">暂无个别提成设置</h3>
              <p class="commission-empty-desc">所有技师目前都遵循门店默认规则。您可以为高级技师或特聘专家设置专属比例。</p>
            </div>
          `;
        }
      } catch (error) {
        showFeedback(error.message, true);
        btn.disabled = false;
      }
    });
  });
}

async function showTechnicianSelector(technicians, session, headers) {
  // 创建覆盖层
  const overlay = document.createElement("div");
  overlay.className = "commission-modal-overlay";
  document.body.appendChild(overlay);

  // 创建内容容器
  const content = document.createElement("div");
  content.className = "commission-modal-content";
  content.innerHTML = `
    <div class="commission-modal-header">
      <h3 class="commission-modal-title">选择技师</h3>
      <button class="commission-modal-close" id="selector-close">
        <span class="material-symbols-outlined">close</span>
      </button>
    </div>
    <div class="commission-selector-list">
      ${technicians.length > 0 
        ? technicians.map(tech => `
          <div class="commission-selector-item" data-technician-id="${tech.technician_user_id}" data-technician-name="${tech.name}">
            <div class="commission-selector-avatar">
              ${tech.avatar_url 
                ? `<img src="${tech.avatar_url}" alt="${tech.name}">`
                : `<div style="width:100%;height:100%;display:flex;align-items:center;justify-content:center;background:#ddd;font-weight:800;color:#666;">${getInitial(tech.name)}</div>`
              }
            </div>
            <div class="commission-selector-info">
              <h4 class="commission-selector-name">${tech.name}</h4>
              <p class="commission-selector-title">${tech.title || "技师"}</p>
            </div>
            <div class="commission-selector-arrow">
              <span class="material-symbols-outlined">chevron_right</span>
            </div>
          </div>
        `).join("")
        : `<div style="text-align: center; padding: 40px; color: #8a8a8a;">暂无技师</div>`
      }
    </div>
  `;
  document.body.appendChild(content);

  // 关闭事件
  const close = () => {
    overlay.remove();
    content.remove();
  };

  overlay.addEventListener("click", close);
  document.getElementById("selector-close")?.addEventListener("click", close);

  // 选择技师事件
  content.querySelectorAll(".commission-selector-item").forEach(item => {
    item.addEventListener("click", () => {
      const technicianId = item.dataset.technicianId;
      const technicianName = item.dataset.technicianName;
      close();
      showTechnicianRuleEditor(technicianId, technicianName, session, headers);
    });
  });
}

async function showTechnicianRuleEditor(technicianUserId, technicianName, session, headers) {
  // 创建覆盖层
  const overlay = document.createElement("div");
  overlay.className = "commission-modal-overlay";
  document.body.appendChild(overlay);

  // 创建内容容器
  const content = document.createElement("div");
  content.className = "commission-modal-content";
  content.innerHTML = `
    <div class="commission-modal-header">
      <h3 class="commission-modal-title">设置 ${technicianName} 的提成规则</h3>
      <button class="commission-modal-close" id="editor-close">
        <span class="material-symbols-outlined">close</span>
      </button>
    </div>
    <div style="display: flex; flex-direction: column; gap: 20px;">
      <div>
        <label style="display: block; font-size: 0.9rem; font-weight: 700; color: #5a5a5a; margin-bottom: 8px;">底薪（元）</label>
        <input type="number" id="tech-rule-base-salary" placeholder="例如：5000" min="0" step="0.01" style="width:100%;padding:18px 20px;border:none;border-radius:24px;background:#e8e8e8;font-size:1.1rem;font-weight:600;color:#4a4a4a;box-sizing:border-box;outline:none;">
      </div>
      <div>
        <label style="display: block; font-size: 0.9rem; font-weight: 700; color: #5a5a5a; margin-bottom: 8px;">点钟费（元）</label>
        <input type="number" id="tech-rule-designated-bonus" placeholder="例如：50" min="0" step="0.01" style="width:100%;padding:18px 20px;border:none;border-radius:24px;background:#e8e8e8;font-size:1.1rem;font-weight:600;color:#4a4a4a;box-sizing:border-box;outline:none;">
      </div>
      <div>
        <label style="display: block; font-size: 0.9rem; font-weight: 700; color: #5a5a5a; margin-bottom: 8px;">排钟提成比例（%）</label>
        <input type="number" id="tech-rule-scheduled-rate" placeholder="例如：20" min="0" max="100" step="0.1" style="width:100%;padding:18px 20px;border:none;border-radius:24px;background:#e8e8e8;font-size:1.1rem;font-weight:600;color:#4a4a4a;box-sizing:border-box;outline:none;">
      </div>
      <div>
        <label style="display: block; font-size: 0.9rem; font-weight: 700; color: #5a5a5a; margin-bottom: 8px;">点钟提成比例（%）</label>
        <input type="number" id="tech-rule-designated-rate" placeholder="例如：35" min="0" max="100" step="0.1" style="width:100%;padding:18px 20px;border:none;border-radius:24px;background:#e8e8e8;font-size:1.1rem;font-weight:600;color:#4a4a4a;box-sizing:border-box;outline:none;">
      </div>
    </div>
    <div style="margin-top: 24px;">
      <button class="commission-primary-btn" id="save-tech-rule">保存规则</button>
    </div>
  `;
  document.body.appendChild(content);

  // 关闭事件
  const close = () => {
    overlay.remove();
    content.remove();
  };

  overlay.addEventListener("click", close);
  document.getElementById("editor-close")?.addEventListener("click", close);

  // 加载现有规则
  try {
    const rulesData = await apiRequest(`/merchant/payroll/rules?shopId=${session.shopId}`, { headers });
    const existingRule = rulesData.overrideRules?.find(r => r.technician_user_id === technicianUserId);

    if (existingRule) {
      document.getElementById("tech-rule-base-salary").value = formatInputValue(existingRule.base_salary || 0);
      document.getElementById("tech-rule-designated-bonus").value = formatInputValue(existingRule.designated_bonus_amount || 0);
      document.getElementById("tech-rule-scheduled-rate").value = String(Number(existingRule.scheduled_commission_rate || 0) * 100);
      document.getElementById("tech-rule-designated-rate").value = String(Number(existingRule.designated_commission_rate || 0) * 100);
    }
  } catch (error) {
    console.error("Failed to load existing rule:", error);
  }

  // 保存事件
  document.getElementById("save-tech-rule")?.addEventListener("click", async () => {
    const baseSalary = parseAmountInputValue(document.getElementById("tech-rule-base-salary")?.value);
    const designatedBonus = parseAmountInputValue(document.getElementById("tech-rule-designated-bonus")?.value);
    const scheduledRate = Number(document.getElementById("tech-rule-scheduled-rate")?.value || 0) / 100;
    const designatedRate = Number(document.getElementById("tech-rule-designated-rate")?.value || 0) / 100;

    const btn = document.getElementById("save-tech-rule");
    btn.disabled = true;
    btn.textContent = "保存中...";

    try {
      await apiRequest(`/merchant/payroll/rules/technicians/${technicianUserId}?shopId=${session.shopId}`, {
        method: "PUT",
        headers,
        body: {
          baseSalary,
          designatedBonusAmount: designatedBonus,
          scheduledCommissionRate: scheduledRate,
          designatedCommissionRate: designatedRate
        }
      });

      close();
      location.reload();
    } catch (error) {
      alert(error.message);
      btn.disabled = false;
      btn.textContent = "保存规则";
    }
  });
}

export default async function init() {
  await initMerchantCommissionSettings();
}
