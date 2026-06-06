import { ensureMerchantSession } from "../utils/session.js";
import { apiRequest } from "../utils/api.js";
import { formatCurrency, formatMonth, formatDateTime, getInitial } from "../utils/format.js";
import { showFieldFeedback } from "../utils/dom.js";

function getCurrentMonth() {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
}

function showMonthPickerModal(session, headers) {
  const existingModal = document.querySelector(".payroll-month-modal");
  if (existingModal) {
    existingModal.remove();
  }

  const modal = document.createElement("div");
  modal.className = "payroll-month-modal";
  modal.innerHTML = `
    <div class="payroll-month-modal-overlay"></div>
    <div class="payroll-month-modal-content">
      <h3 style="margin: 0 0 16px; font-size: 1.25rem;">选择工资周期</h3>
      <p style="color: var(--on-surface-variant); margin-bottom: 16px; font-size: 0.9rem;">
        选择要生成工资单的月份。系统将自动计算当月所有已完成订单的工资。
      </p>
      <input type="month" id="payroll-cycle-picker" value="${getCurrentMonth()}"
        min="2020-01" max="${getCurrentMonth()}"
        style="width: 100%; padding: 12px; border: 1px solid var(--outline); border-radius: 12px; font-size: 1rem; box-sizing: border-box;">
      <div style="display: flex; gap: 12px; margin-top: 20px; justify-content: space-between;">
        <button class="merchant-mobile-button ghost" id="payroll-cycle-cancel">取消</button>
        <button class="merchant-mobile-button primary" id="payroll-cycle-confirm">确定</button>
      </div>
    </div>
  `;

  document.body.appendChild(modal);

  const style = document.createElement("style");
  style.textContent = `
    .payroll-month-modal {
      position: fixed;
      inset: 0;
      z-index: 1000;
      display: flex;
      align-items: center;
      justify-content: center;
    }
    .payroll-month-modal-overlay {
      position: absolute;
      inset: 0;
      background: rgba(0, 0, 0, 0.4);
    }
    .payroll-month-modal-content {
      position: relative;
      background: var(--surface-container-lowest);
      padding: 24px;
      border-radius: 20px;
      max-width: 360px;
      width: 90%;
      box-shadow: var(--shadow-soft);
    }
    .merchant-mobile-button {
      padding: 12px 24px;
      border-radius: 12px;
      font-size: 1rem;
      font-weight: 600;
      border: none;
      cursor: pointer;
      transition: all 0.2s;
      min-width: 100px;
    }
    .merchant-mobile-button.ghost {
      background: transparent;
      color: #666;
      border: 1px solid #ddd;
    }
    .merchant-mobile-button.ghost:hover {
      background: rgba(0, 0, 0, 0.05);
    }
    .merchant-mobile-button.primary {
      background: #059669;
      color: white;
      border: none;
    }
    .merchant-mobile-button.primary:hover {
      background: #047857;
    }
    .merchant-mobile-button:disabled {
      opacity: 0.6;
      cursor: not-allowed;
    }
  `;
  document.head.appendChild(style);

  modal.querySelector(".payroll-month-modal-overlay").addEventListener("click", () => modal.remove());
  modal.querySelector("#payroll-cycle-cancel").addEventListener("click", () => modal.remove());

  modal.querySelector("#payroll-cycle-confirm").addEventListener("click", async () => {
    const monthInput = modal.querySelector("#payroll-cycle-picker");
    const cycleMonth = monthInput.value;

    if (!cycleMonth) {
      return;
    }

    const confirmBtn = modal.querySelector("#payroll-cycle-confirm");
    const cancelBtn = modal.querySelector("#payroll-cycle-cancel");
    confirmBtn.disabled = true;
    cancelBtn.disabled = true;
    confirmBtn.textContent = "生成中...";

    try {
      showFieldFeedback("payroll-loading-feedback", `正在生成 ${cycleMonth} 工资单...`);

      const cycleData = await apiRequest(`/merchant/payroll/cycles?shopId=${session.shopId}`, { headers });
      const existingCycle = cycleData.cycles?.find(c => {
        const cycleMonthStr = new Date(c.cycle_month).toISOString().slice(0, 7);
        return cycleMonthStr === cycleMonth;
      });

      if (existingCycle) {
        await apiRequest(`/merchant/payroll/cycles/${existingCycle.id}/recalculate?shopId=${session.shopId}`, {
          method: "POST",
          headers
        });
      } else {
        await apiRequest(`/merchant/payroll/cycles?shopId=${session.shopId}`, {
          method: "POST",
          headers,
          body: { cycleMonth }
        });
        const newCyclesData = await apiRequest(`/merchant/payroll/cycles?shopId=${session.shopId}`, { headers });
        const newCycle = newCyclesData.cycles?.find(c => {
          const cycleMonthStr = new Date(c.cycle_month).toISOString().slice(0, 7);
          return cycleMonthStr === cycleMonth;
        });
        if (newCycle) {
          await apiRequest(`/merchant/payroll/cycles/${newCycle.id}/recalculate?shopId=${session.shopId}`, {
            method: "POST",
            headers
          });
        }
      }

      modal.remove();
      location.reload();
    } catch (error) {
      showFieldFeedback("payroll-loading-feedback", error.message, true);
      confirmBtn.disabled = false;
      cancelBtn.disabled = false;
      confirmBtn.textContent = "确定生成";
    }
  });
}

function renderPayrollList(summaries, filter = "pending") {
  const filteredSummaries = summaries.filter(s => {
    if (filter === "pending") return s.payment_status === "pending";
    if (filter === "paid") return s.payment_status === "paid";
    return true;
  });

  const listContainer = document.getElementById("payroll-list");
  if (!listContainer) return;

  if (filteredSummaries.length === 0) {
    listContainer.innerHTML = `
      <div style="text-align: center; padding: 60px 20px; color: var(--on-surface-variant);">
        <span class="material-symbols-outlined" style="font-size: 48px; opacity: 0.5;">receipt_long</span>
        <p style="margin-top: 16px; font-size: 1rem;">暂无${filter === "pending" ? "待发放" : "已发放"}工资记录</p>
      </div>
    `;
    return;
  }

  listContainer.innerHTML = filteredSummaries.map(summary => `
    <article class="payroll-item-card" data-summary-id="${summary.id}" data-technician-name="${summary.name}">
      <div class="payroll-item-avatar">
        ${summary.avatar_url 
          ? `<img src="${summary.avatar_url}" alt="${summary.name}">`
          : `<div class="avatar-fallback">${getInitial(summary.name)}</div>`
        }
      </div>
      <div class="payroll-item-info">
        <h3>${summary.name}</h3>
        <p>${summary.completed_order_count} 单 · ${formatCurrency(summary.base_salary_amount)} 底薪</p>
      </div>
      <div class="payroll-item-amount">
        <strong>${formatCurrency(summary.gross_salary_amount)}</strong>
        <span class="mobile-status-pill ${summary.payment_status === "paid" ? "success" : "warning"}">
          ${summary.payment_status === "paid" ? "已结算" : "待结算"}
        </span>
      </div>
    </article>
  `).join("");

  listContainer.querySelectorAll(".payroll-item-card").forEach(card => {
    card.addEventListener("click", () => {
      const summaryId = card.dataset.summaryId;
      const technicianName = card.dataset.technicianName;
      showPayrollDetailModal(summaryId, technicianName);
    });
  });
}

function renderRealtimeEarnings(data) {
  const listContainer = document.getElementById("realtime-list");
  if (!listContainer) return;

  if (!data.technicians || data.technicians.length === 0) {
    listContainer.innerHTML = `
      <div style="text-align: center; padding: 60px 20px; color: var(--on-surface-variant);">
        <span class="material-symbols-outlined" style="font-size: 48px; opacity: 0.5;">attach_money</span>
        <p style="margin-top: 16px; font-size: 1rem;">暂无技师数据</p>
      </div>
    `;
    return;
  }

  listContainer.innerHTML = `
    ${data.technicians.map(tech => `
      <article class="realtime-item-card" style="background: var(--surface-container-lowest); border-radius: 16px; padding: 16px; margin-bottom: 12px; box-shadow: var(--shadow-soft); cursor: pointer;" data-technician-id="${tech.technician_user_id}">
        <div style="display: flex; gap: 12px; align-items: center;">
          <div style="width: 52px; height: 52px; border-radius: 50%; background: var(--surface-container); overflow: hidden; flex-shrink: 0;">
            ${tech.avatar_url 
              ? `<img src="${tech.avatar_url}" alt="${tech.name}" style="width: 100%; height: 100%; object-fit: cover;">`
              : `<div style="width: 100%; height: 100%; display: flex; align-items: center; justify-content: center; font-weight: 700; color: var(--on-surface-variant);">${getInitial(tech.name)}</div>`
            }
          </div>
          <div style="flex: 1;">
            <h3 style="margin: 0 0 4px; font-size: 1.05rem; font-weight: 700;">${tech.name}</h3>
            <p style="margin: 0; font-size: 0.9rem; color: var(--on-surface-variant);">工号: ${tech.employee_no || '未设置'}</p>
          </div>
          <div style="text-align: right;">
            <strong style="font-size: 1.25rem; color: var(--emerald-600); display: block;">${formatCurrency(tech.gross_salary_amount)}</strong>
            <span style="font-size: 0.85rem; color: var(--on-surface-variant);">
              ${tech.completed_order_count} 单
            </span>
          </div>
        </div>
      </article>
    `).join("")}
  `;

  listContainer.querySelectorAll(".realtime-item-card").forEach(card => {
    card.addEventListener("click", () => {
      const techId = card.dataset.technicianId;
      const tech = data.technicians.find(t => t.technician_user_id === techId);
      if (tech) {
        showRealtimeDetailModal(tech);
      }
    });
  });
}

async function showRealtimeDetailModal(tech) {
  const modal = document.createElement("div");
  modal.className = "realtime-detail-modal";
  modal.innerHTML = `
    <div class="realtime-detail-modal-overlay"></div>
    <div class="realtime-detail-modal-content">
      <!-- 头部 -->
      <div class="realtime-detail-header">
        <div style="display: flex; align-items: center; gap: 12px;">
          <div style="width: 48px; height: 48px; border-radius: 50%; background: #f0f0f0; overflow: hidden; display: flex; align-items: center; justify-content: center; font-weight: 700; color: #666;">
            ${getInitial(tech.name)}
          </div>
          <div>
            <h3 style="margin: 0; font-size: 1.15rem; font-weight: 700;">${tech.name}</h3>
            <p style="margin: 4px 0 0; font-size: 0.85rem; color: #999;">技师工号: ${tech.employee_no || '未设置'}</p>
          </div>
        </div>
        <button class="realtime-detail-close" id="realtime-detail-close" style="background: none; border: none; cursor: pointer; padding: 8px;">
          <span class="material-symbols-outlined" style="font-size: 24px; color: #333;">close</span>
        </button>
      </div>
      
      <div class="realtime-detail-body">
        <!-- 收入总览标题 -->
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 16px;">
          <h3 style="margin: 0; font-size: 1.1rem; font-weight: 700;">收入总览</h3>
          <div style="display: flex; align-items: center; gap: 4px; padding: 6px 12px; background: #f5f5f5; border-radius: 20px; font-size: 0.85rem; color: #666; cursor: pointer;">
            <span class="material-symbols-outlined" style="font-size: 16px;">calendar_today</span>
            <span>本月</span>
            <span class="material-symbols-outlined" style="font-size: 16px;">expand_more</span>
          </div>
        </div>
        
        <!-- 本月预计收入卡片 -->
        <div style="background: #1a5f4a; border-radius: 16px; padding: 20px; color: white; margin-bottom: 20px; display: flex; justify-content: space-between; align-items: flex-end;">
          <div>
            <div style="font-size: 0.9rem; opacity: 0.9; margin-bottom: 8px;">本月预计收入</div>
            <div style="font-size: 2.2rem; font-weight: 800;">${formatCurrency(tech.gross_salary_amount)}</div>
          </div>
          <div style="text-align: right; display: flex; gap: 8px; align-items: baseline;">
            <div style="font-size: 12px; font-weight: 700;">${tech.completed_order_count || 0} 单</div>
          </div>
        </div>
        
        <!-- 收入明细标题 -->
        <h4 style="margin: 0 0 12px; font-size: 1rem; font-weight: 700;">收入明细</h4>
        
        <!-- 收入明细网格 -->
        <div style="display: grid; grid-template-columns: repeat(2, 1fr); gap: 10px; margin-bottom: 20px;">
          <div style="background: white; border-radius: 12px; padding: 16px; border: 1px solid #f0f0f0;">
            <div style="display: flex; align-items: center; gap: 6px; margin-bottom: 8px;">
              <span class="material-symbols-outlined" style="font-size: 18px; color: #999;">payments</span>
              <span style="font-size: 0.85rem; color: #666;">底薪</span>
            </div>
            <div style="font-size: 1.3rem; font-weight: 700; color: #333;">${formatCurrency(tech.base_salary_amount)}</div>
          </div>
          
          <div style="background: white; border-radius: 12px; padding: 16px; border: 1px solid #f0f0f0;">
            <div style="display: flex; align-items: center; gap: 6px; margin-bottom: 8px;">
              <span class="material-symbols-outlined" style="font-size: 18px; color: #059669;">trending_up</span>
              <span style="font-size: 0.85rem; color: #666;">排钟提成 <span style="color: #059669;">(${(tech.scheduled_commission_rate * 100).toFixed(0)}%)</span></span>
            </div>
            <div style="font-size: 1.3rem; font-weight: 700; color: #333;">${formatCurrency(tech.scheduled_commission_amount)}</div>
          </div>
          
          <div style="background: white; border-radius: 12px; padding: 16px; border: 1px solid #f0f0f0;">
            <div style="display: flex; align-items: center; gap: 6px; margin-bottom: 8px;">
              <span class="material-symbols-outlined" style="font-size: 18px; color: #059669;">star</span>
              <span style="font-size: 0.85rem; color: #666;">点钟提成 <span style="color: #059669;">(${(tech.designated_commission_rate * 100).toFixed(0)}%)</span></span>
            </div>
            <div style="font-size: 1.3rem; font-weight: 700; color: #333;">${formatCurrency(tech.designated_commission_amount)}</div>
          </div>
          
          <div style="background: white; border-radius: 12px; padding: 16px; border: 1px solid #f0f0f0;">
            <div style="display: flex; align-items: center; gap: 6px; margin-bottom: 8px;">
              <span class="material-symbols-outlined" style="font-size: 18px; color: #999;">receipt</span>
              <span style="font-size: 0.85rem; color: #666;">点钟费合计</span>
            </div>
            <div style="font-size: 1.3rem; font-weight: 700; color: #333;">${formatCurrency(tech.designated_bonus_total)}</div>
          </div>
          
          <div style="background: white; border-radius: 12px; padding: 16px; border: 1px solid #f0f0f0;">
            <div style="display: flex; align-items: center; gap: 6px; margin-bottom: 8px;">
              <span class="material-symbols-outlined" style="font-size: 18px; color: #999;">calculate</span>
              <span style="font-size: 0.85rem; color: #666;">排钟服务总额</span>
            </div>
            <div style="font-size: 1.3rem; font-weight: 700; color: #333;">${formatCurrency(tech.scheduled_amount_total)}</div>
          </div>
          
          <div style="background: white; border-radius: 12px; padding: 16px; border: 1px solid #f0f0f0;">
            <div style="display: flex; align-items: center; gap: 6px; margin-bottom: 8px;">
              <span class="material-symbols-outlined" style="font-size: 18px; color: #999;">calculate</span>
              <span style="font-size: 0.85rem; color: #666;">点钟服务总额</span>
            </div>
            <div style="font-size: 1.3rem; font-weight: 700; color: #333;">${formatCurrency(tech.designated_amount_total)}</div>
          </div>
        </div>

        <!-- 最近订单标题 -->
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 12px;">
          <h4 style="margin: 0; font-size: 1rem; font-weight: 700;">最近订单</h4>
          <span style="font-size: 0.85rem; color: #666; cursor: pointer;">查看全部</span>
        </div>
        
        <!-- 最近订单列表 -->
        <div style="margin-top: 12px;">
          ${tech.recent_orders && tech.recent_orders.length > 0 
            ? tech.recent_orders.map(order => `
              <div class="order-item-card" style="background: white; border-radius: 12px; padding: 14px; margin-bottom: 10px; display: flex; gap: 12px; cursor: pointer; transition: all 0.2s ease; border: 1px solid #f0f0f0;" data-order-id="${order.id}" data-order-no="${order.order_no}">
                <!-- 服务图标 -->
                <div style="width: 44px; height: 44px; border-radius: 10px; background: #e8f5e9; display: flex; align-items: center; justify-content: center; flex-shrink: 0;">
                  <span class="material-symbols-outlined" style="font-size: 24px; color: #059669;">spa</span>
                </div>
                
                <!-- 订单信息 -->
                <div style="flex: 1; min-width: 0;">
                  <div style="display: flex; align-items: center; gap: 8px; margin-bottom: 4px;">
                    <span style="font-size: 0.95rem; font-weight: 600; color: #333;">${order.service_name || "全身精油SPA"}</span>
                    <span style="font-size: 0.75rem; padding: 2px 8px; border-radius: 10px; background: ${order.order_type === 'designated' ? '#e8f5e9' : '#e3f2fd'}; color: ${order.order_type === 'designated' ? '#059669' : '#1976d2'};">
                      ${order.order_type === 'designated' ? '点钟' : '排钟'}
                    </span>
                  </div>
                  <p style="margin: 0 0 4px; font-size: 0.85rem; color: #999;">订单号: ${order.order_no}</p>
                  <div style="display: flex; align-items: center; gap: 4px; font-size: 0.85rem; color: #999;">
                    <span class="material-symbols-outlined" style="font-size: 14px;">schedule</span>
                    <span>${formatDateTime(order.start_time)}</span>
                  </div>
                </div>
                
                <!-- 金额信息 -->
                <div style="text-align: right; flex-shrink: 0;">
                  <div style="font-size: 1.1rem; font-weight: 700; color: #059669; margin-bottom: 4px;">+${formatCurrency((order.commission_amount || 0) + (order.designated_bonus_amount || 0))}</div>
                  <div style="font-size: 0.8rem; color: #999;">订单总计 ${formatCurrency(order.service_amount)}</div>
                </div>
              </div>
            `).join('')
            : `<div style="text-align: center; padding: 40px; color: #999;">暂无最近订单</div>`
          }
        </div>
      </div>
    </div>
  `;

  document.body.appendChild(modal);

  const style = document.createElement("style");
  style.textContent = `
    .realtime-detail-modal {
      position: fixed;
      inset: 0;
      z-index: 1000;
      display: flex;
      align-items: flex-end;
      justify-content: center;
    }
    .realtime-detail-modal-overlay {
      position: absolute;
      inset: 0;
      background: rgba(0, 0, 0, 0.4);
    }
    .realtime-detail-modal-content {
      position: relative;
      background: #fafafa;
      border-radius: 24px 24px 0 0;
      max-width: 480px;
      width: 100%;
      max-height: 85vh;
      overflow-y: auto;
      box-shadow: 0 -4px 24px rgba(0, 0, 0, 0.15);
    }
    .realtime-detail-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      padding: 16px 20px;
      border-bottom: 1px solid #f0f0f0;
      position: sticky;
      top: 0;
      background: #fafafa;
      z-index: 10;
    }
    .realtime-detail-close {
      width: 40px;
      height: 40px;
      border-radius: 50%;
      border: none;
      background: #f0f0f0;
      cursor: pointer;
      display: flex;
      align-items: center;
      justify-content: center;
      transition: background 0.2s ease;
    }
    .realtime-detail-close:hover {
      background: #e0e0e0;
    }
    .realtime-detail-body {
      padding: 20px;
    }
    .order-item-card:hover {
      background: #f5f5f5 !important;
      transform: translateY(-1px);
      box-shadow: 0 2px 8px rgba(0,0,0,0.08);
    }
  `;
  document.head.appendChild(style);

  modal.querySelector(".realtime-detail-modal-overlay").addEventListener("click", () => modal.remove());
  modal.querySelector("#realtime-detail-close").addEventListener("click", () => modal.remove());

  // 添加订单卡片点击事件
  modal.querySelectorAll(".order-item-card").forEach(card => {
    card.addEventListener("click", () => {
      const orderNo = card.dataset.orderNo;
      if (orderNo) {
        showOrderDetailModal(orderNo);
      }
    });
  });
}

async function showOrderDetailModal(orderNo) {
  const session = ensureMerchantSession();
  const headers = {
    "x-shop-id": session.shopId,
    "x-user-id": session.user.id
  };

  try {
    const data = await apiRequest(`/merchant/orders?shopId=${session.shopId}&orderNo=${encodeURIComponent(orderNo)}`, { headers });
    const orders = data.orders || [];
    const order = orders.find(o => o.order_no === orderNo);

    if (!order) {
      showFieldFeedback("realtime-loading-feedback", "订单未找到", true);
      return;
    }

    // 创建遮罩层
    const backdrop = document.createElement("div");
    backdrop.className = "mobile-sheet-backdrop";
    backdrop.style.zIndex = "1099";
    document.body.appendChild(backdrop);

    const modal = document.createElement("section");
    modal.className = "mobile-bottom-sheet";
    modal.style.display = "block";
    modal.style.zIndex = "1100";
    modal.innerHTML = `
      <div class="mobile-sheet-handle"></div>
      <div class="mobile-sheet-head">
        <div>
          <h2>订单详情</h2>
          <p>用于查看服务与结算信息。</p>
        </div>
        <button class="merchant-mobile-icon-button" type="button" id="order-detail-close" aria-label="关闭详情面板">
          <span class="material-symbols-outlined">close</span>
        </button>
      </div>
      <div class="mobile-sheet-body">
        <div class="mobile-sheet-records" id="order-detail-items">
          ${[
            ["订单号", order.order_no || "--"],
            ["订单类型", order.order_type === "designated" ? "点钟" : "排钟"],
            ["服务项目", order.service_name || "--"],
            ["技师", order.technician_name || "--"],
            ["客户", order.customer_type === "registered" ? (order.customer_name || "--") : "散客"],
            ["房间", order.room_name || order.room_code || "--"],
            ["开始时间", order.start_time ? formatDateTime(order.start_time) : "未开始"],
            ["结束时间", order.end_time ? formatDateTime(order.end_time) : order.status === "pending" ? "未开始" : "进行中"],
            ["服务金额", formatCurrency(order.service_amount)],
            ["实收金额", order.status === "completed" && order.actual_amount ? formatCurrency(order.actual_amount) : "待结算"],
            ["备注", order.note || "暂无备注"]
          ].map(([label, value]) => `
            <div class="record-row">
              <div class="small">${label}</div>
              <div>${value}</div>
            </div>
          `).join('')}
        </div>
      </div>
    `;

    document.body.appendChild(modal);

    const closeModal = () => {
      modal.remove();
      backdrop.remove();
    };

    modal.querySelector("#order-detail-close").addEventListener("click", closeModal);
    backdrop.addEventListener("click", closeModal);
  } catch (error) {
    showFieldFeedback("realtime-loading-feedback", error.message, true);
  }
}

async function showPayrollDetailModal(summaryId, technicianName) {
  const session = ensureMerchantSession();
  const headers = {
    "x-shop-id": session.shopId,
    "x-user-id": session.user.id
  };

  try {
    const data = await apiRequest(`/merchant/payroll/summaries/${summaryId}/items?shopId=${session.shopId}`, { headers });

    const modal = document.createElement("div");
    modal.className = "payroll-detail-modal";
    modal.innerHTML = `
      <div class="payroll-detail-modal-overlay"></div>
      <div class="payroll-detail-modal-content">
        <div class="payroll-detail-header">
          <h3>${technicianName} · 订单明细</h3>
          <button class="merchant-mobile-icon-button" id="payroll-detail-close">
            <span class="material-symbols-outlined">close</span>
          </button>
        </div>
        <div class="payroll-detail-body" id="payroll-detail-items">
          ${data.items?.length > 0 
            ? data.items.map(item => `
              <div class="payroll-detail-item">
                <div class="payroll-detail-item-header">
                  <span class="payroll-detail-order-type ${item.order_type === "designated" ? "designated" : "scheduled"}">
                    ${item.order_type === "designated" ? "点钟" : "排钟"}
                  </span>
                  <strong>${formatCurrency(item.commission_amount)}</strong>
                </div>
                <div class="payroll-detail-item-info">
                  <p>订单号：${item.order_no}</p>
                  <p>客户：${item.customer_name || "到店客户"} · 房号：${item.room_code || "--"}</p>
                  <p>${formatDateTime(item.start_time)}</p>
                </div>
                <div class="payroll-detail-item-amount">
                  <span>服务金额 ${formatCurrency(item.service_amount)}</span>
                  ${item.designated_bonus_amount > 0 ? `<span>点钟费 ${formatCurrency(item.designated_bonus_amount)}</span>` : ""}
                </div>
              </div>
            `).join("")
            : `<div style="text-align: center; padding: 40px; color: var(--on-surface-variant);">暂无订单明细</div>`
          }
        </div>
      </div>
    `;

    document.body.appendChild(modal);

    // 添加订单卡片点击事件
    modal.querySelectorAll(".payroll-detail-item").forEach(card => {
      card.addEventListener("click", () => {
        const orderNo = card.querySelector(".payroll-detail-item-info p")?.textContent?.replace("订单号：", "");
        if (orderNo) {
          showOrderDetailModal(orderNo);
        }
      });

      card.style.cursor = "pointer";

      // 添加悬停效果
      card.addEventListener("mouseenter", () => {
        card.style.transform = "translateY(-2px)";
        card.style.boxShadow = "var(--shadow-soft)";
      });

      card.addEventListener("mouseleave", () => {
        card.style.transform = "translateY(0)";
        card.style.boxShadow = "none";
      });
    });

    const style = document.createElement("style");
    style.textContent = `
      .payroll-detail-modal {
        position: fixed;
        inset: 0;
        z-index: 1000;
        display: flex;
        align-items: flex-end;
        justify-content: center;
      }
      .payroll-detail-modal-overlay {
        position: absolute;
        inset: 0;
        background: rgba(0, 0, 0, 0.4);
      }
      .payroll-detail-modal-content {
        position: relative;
        background: var(--surface-container-lowest);
        border-radius: 24px 24px 0 0;
        max-width: 480px;
        width: 100%;
        max-height: 80vh;
        overflow-y: auto;
        box-shadow: 0 -4px 24px rgba(0, 0, 0, 0.15);
      }
      .payroll-detail-header {
        display: flex;
        justify-content: space-between;
        align-items: center;
        padding: 20px;
        border-bottom: 1px solid var(--outline);
        position: sticky;
        top: 0;
        background: var(--surface-container-lowest);
      }
      .payroll-detail-header h3 {
        margin: 0;
        font-size: 1.2rem;
        font-weight: 700;
      }
      .merchant-mobile-icon-button {
        width: 40px;
        height: 40px;
        border-radius: 50%;
        border: none;
        background: var(--surface-container);
        cursor: pointer;
        display: flex;
        align-items: center;
        justify-content: center;
      }
      .payroll-detail-body {
        padding: 16px;
      }
      .payroll-detail-item {
        background: var(--surface-container);
        border-radius: 16px;
        padding: 16px;
        margin-bottom: 12px;
      }
      .payroll-detail-item-header {
        display: flex;
        justify-content: space-between;
        align-items: center;
        margin-bottom: 12px;
      }
      .payroll-detail-order-type {
        padding: 4px 12px;
        border-radius: 20px;
        font-size: 0.85rem;
        font-weight: 600;
      }
      .payroll-detail-order-type.designated {
        background: rgba(16, 185, 129, 0.1);
        color: var(--emerald-600);
      }
      .payroll-detail-order-type.scheduled {
        background: rgba(59, 130, 246, 0.1);
        color: #3b82f6;
      }
      .payroll-detail-item-header strong {
        font-size: 1.2rem;
        color: var(--emerald-600);
      }
      .payroll-detail-item-info {
        margin-bottom: 12px;
      }
      .payroll-detail-item-info p {
        margin: 4px 0;
        font-size: 0.9rem;
        color: var(--on-surface-variant);
      }
      .payroll-detail-item-amount {
        display: flex;
        gap: 16px;
        font-size: 0.85rem;
        color: var(--on-surface);
      }
    `;
    document.head.appendChild(style);

    modal.querySelector(".payroll-detail-modal-overlay").addEventListener("click", () => modal.remove());
    modal.querySelector("#payroll-detail-close").addEventListener("click", () => modal.remove());

  } catch (error) {
    showFieldFeedback("payroll-loading-feedback", error.message, true);
  }
}

export async function initMerchantPayrollDetail() {
  const session = ensureMerchantSession();
  console.log("Session data:", session);
  
  const headers = {
    "x-shop-id": session.shopId,
    "x-user-id": session.user.id
  };

  document.getElementById("payroll-back")?.addEventListener("click", () => {
    history.back();
  });

  document.getElementById("payroll-generate-fab")?.addEventListener("click", () => {
    showMonthPickerModal(session, headers);
  });

  let currentFilter = "realtime";
  let allSummaries = [];
  let realtimeData = null;

  try {
    console.log("Initializing payroll detail...");
    console.log("Session:", session);
    console.log("API URL:", `${window.location.protocol}//${window.location.hostname}:3001/api/v1`);
    
    let overviewData, summaryData, realtimeDataResult;
    
    try {
      console.log("Fetching overview data...");
      overviewData = await apiRequest(`/merchant/payroll/overview?shopId=${session.shopId}`, { headers });
      console.log("Overview fetched:", overviewData);
    } catch (err) {
      console.error("Failed to fetch overview:", err);
      overviewData = { month: new Date().toISOString().slice(0, 7), overview: {} };
    }
    
    try {
      console.log("Fetching summary data...");
      summaryData = await apiRequest(`/merchant/payroll/summaries?shopId=${session.shopId}`, { headers });
      console.log("Summary fetched:", summaryData);
    } catch (err) {
      console.error("Failed to fetch summary:", err);
      summaryData = { summaries: [] };
    }
    
    try {
      console.log("Fetching realtime data...");
      realtimeDataResult = await apiRequest(`/merchant/payroll/real-time?shopId=${session.shopId}`, { headers });
      console.log("Realtime fetched:", realtimeDataResult);
    } catch (err) {
      console.error("Failed to fetch realtime:", err);
      realtimeDataResult = { technicians: [], total_amount: 0 };
    }

    console.log("Overview data:", overviewData);
    console.log("Summary data:", summaryData);
    console.log("Realtime data:", realtimeDataResult);
    console.log("Overview overview:", overviewData?.overview);

    allSummaries = summaryData.summaries || [];
    realtimeData = realtimeDataResult;

    const monthLabel = formatMonth(overviewData.month);
    
    const technicianCount = overviewData.overview?.technician_count || (realtimeData?.technicians?.length || 0);
    const totalAmount = overviewData.overview?.total_salary_amount || (realtimeData?.total_amount || 0);
    const paidCount = overviewData.overview?.paid_count || 0;
    const pendingCount = overviewData.overview?.pending_count || technicianCount;
    const paidAmount = overviewData.overview?.paid_amount || 0;
    const pendingAmount = overviewData.overview?.pending_amount || totalAmount;

    console.log("Calculated values:", { technicianCount, totalAmount, paidCount, pendingCount, paidAmount, pendingAmount });

    const monthSidebar = document.getElementById("payroll-cycle-month-sidebar");
    if (monthSidebar) monthSidebar.textContent = monthLabel;
    
    document.querySelector(".mobile-hero-label").textContent = `${monthLabel} 应发薪资总计`;
    document.querySelector(".payroll-technician-count").textContent = `${technicianCount}位技师`;
    document.querySelector(".payroll-total-amount").textContent = formatCurrency(totalAmount);

    const summaryItems = document.querySelectorAll(".payroll-summary-item");
    if (summaryItems[0]) {
      summaryItems[0].querySelector("strong").textContent = formatCurrency(paidAmount);
      summaryItems[0].querySelector(".payroll-summary-sub").textContent = `${paidCount}人`;
    }
    if (summaryItems[1]) {
      summaryItems[1].querySelector("strong").textContent = formatCurrency(pendingAmount);
      summaryItems[1].querySelector(".payroll-summary-sub").textContent = `${pendingCount}人`;
    }

    // 设置默认激活的tab和显示内容
    const statusButtons = Array.from(document.querySelectorAll("[data-payroll-filter]"));
    statusButtons.forEach((btn) => {
      btn.classList.toggle("active", btn.dataset.payrollFilter === currentFilter);
    });
    
    const payrollList = document.getElementById("payroll-list");
    const realtimeList = document.getElementById("realtime-list");
    
    payrollList.style.display = "none";
    realtimeList.style.display = "block";
    if (realtimeData) {
      renderRealtimeEarnings(realtimeData);
    }

  } catch (error) {
    console.error("Failed to load payroll data:", error);
    const listContainer = document.getElementById("payroll-list");
    if (listContainer) {
      listContainer.innerHTML = `
        <div style="text-align: center; padding: 60px 20px; color: var(--on-surface-variant);">
          <span class="material-symbols-outlined" style="font-size: 48px; opacity: 0.5;">error_outline</span>
          <p style="margin-top: 16px; font-size: 1rem;">加载失败，请重试</p>
          <button class="merchant-mobile-button primary" onclick="location.reload()" style="margin-top: 16px;">刷新页面</button>
        </div>
      `;
    }
  }

  const statusButtons = Array.from(document.querySelectorAll("[data-payroll-filter]"));
  statusButtons.forEach((button) => {
    button.addEventListener("click", () => {
      currentFilter = button.dataset.payrollFilter;
      statusButtons.forEach((btn) => {
        btn.classList.toggle("active", btn.dataset.payrollFilter === currentFilter);
      });
      
      const payrollList = document.getElementById("payroll-list");
      const realtimeList = document.getElementById("realtime-list");
      
      if (currentFilter === "realtime") {
        payrollList.style.display = "none";
        realtimeList.style.display = "block";
        if (realtimeData) {
          renderRealtimeEarnings(realtimeData);
        }
      } else {
        payrollList.style.display = "block";
        realtimeList.style.display = "none";
        renderPayrollList(allSummaries, currentFilter);
      }
    });
  });
}

export default async function init() {
  await initMerchantPayrollDetail();
}
