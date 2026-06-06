import { ensureMerchantSession } from "../utils/session.js";
import { apiRequest } from "../utils/api.js";
import { formatCurrency, getInitial } from "../utils/format.js";
import { renderFallback } from "../utils/dom.js";

function renderRecords(container, rows) {
  if (!container) return;
  container.innerHTML = rows.map(([label, value]) => `
    <div class="record-row">
      <div class="small">${label}</div>
      <div>${value}</div>
    </div>
  `).join("");
}

export async function initMerchantTechnicians() {
  const session = ensureMerchantSession();
  const headers = {
    "x-shop-id": session.shopId,
    "x-user-id": session.user.id
  };

  const [technicianData, applicationData] = await Promise.all([
    apiRequest(`/merchant/technicians?shopId=${session.shopId}`, { headers }),
    apiRequest(`/merchant/technician-applications?shopId=${session.shopId}`, { headers })
  ]);

  const technicians = technicianData.technicians || [];
  const applications = applicationData.applications || [];
  const backdrop = document.getElementById("technician-sheet-backdrop");
  const detailPanel = document.getElementById("technician-detail-panel");
  const applicationPanel = document.getElementById("applications");
  const detailInfo = document.getElementById("technician-detail-info");
  const detailPerformance = document.getElementById("technician-detail-performance");

  const totalCount = technicians.length;
  const inServiceCount = technicians.filter((item) => item.service_status === "in_service").length;
  const availableCount = technicians.filter((item) => item.service_status === "available").length;
  const monthRevenueTotal = technicians.reduce((sum, item) => sum + Number(item.month_revenue || 0), 0);
  const pendingSettlement = technicians
    .filter((item) => item.service_status === "in_service")
    .reduce((sum, item) => sum + Number(item.month_revenue || 0) * 0.05, 0);
  const settledAmount = Math.max(0, monthRevenueTotal - pendingSettlement);

  document.getElementById("technician-settlement-total").textContent = formatCurrency(monthRevenueTotal);
  document.getElementById("technician-settlement-pending").textContent = formatCurrency(pendingSettlement);
  document.getElementById("technician-settlement-paid").textContent = formatCurrency(settledAmount);
  document.getElementById("application-title").textContent = `待处理申请 (${applications.filter((item) => item.status === "pending").length})`;

  const serviceStar = [...technicians].sort((a, b) => Number(b.completed_order_count || 0) - Number(a.completed_order_count || 0))[0];
  if (serviceStar) {
    document.getElementById("technician-star-avatar").textContent = getInitial(serviceStar.name);
    document.getElementById("technician-star-name").textContent = serviceStar.name;
    document.getElementById("technician-star-rating").textContent = `★★★★★ ${(4.6 + Math.min(0.3, Number(serviceStar.years_experience || 0) / 20)).toFixed(1)}`;
    document.getElementById("technician-star-orders").textContent = String(serviceStar.completed_order_count || 0);
  }

  function closePanels() {
    detailPanel.hidden = true;
    applicationPanel.hidden = true;
    backdrop.hidden = true;
  }

  function openPanel(panel) {
    detailPanel.hidden = panel !== detailPanel;
    applicationPanel.hidden = panel !== applicationPanel;
    backdrop.hidden = false;
  }

  function renderDetail(technician) {
    renderRecords(detailInfo, [
      ["技师姓名", technician.name],
      ["工号", technician.employee_no || technician.technician_user_id.slice(0, 8)],
      ["当前状态", technician.service_status === "available" ? "待命" : technician.service_status === "in_service" ? "服务中" : "休息"],
      ["出勤状态", technician.attendance_status === "on_duty" ? "在岗" : technician.attendance_status === "resting" ? "休息" : "离岗"]
    ]);
    renderRecords(detailPerformance, [
      ["从业年限", `${technician.years_experience || 0} 年`],
      ["本月上钟", `${technician.completed_order_count || 0} 次`],
      ["本月营收", formatCurrency(technician.month_revenue || 0)],
      ["擅长项目", (technician.specialties || []).join(" / ") || "未填写"]
    ]);
    openPanel(detailPanel);
  }

  const applicationList = document.getElementById("application-list");
  if (!applications.length) {
    renderFallback(applicationList, "当前没有待处理申请。");
  } else {
    applicationList.innerHTML = applications.map((application) => `
      <article class="mobile-entry-card">
        <div class="mobile-entry-icon theme-mist">
          <span class="material-symbols-outlined">person_add</span>
        </div>
        <div class="mobile-entry-copy">
          <h3>${application.name}</h3>
          <p>${(application.specialties || []).join(" / ") || "技师申请"}</p>
        </div>
        <div class="mobile-sheet-inline-actions">
          <button class="mobile-sheet-secondary" type="button" data-reject-application="${application.id}">拒绝</button>
          <button class="mobile-sheet-primary" type="button" data-approve-application="${application.id}">通过</button>
        </div>
      </article>
    `).join("");

    applicationList.querySelectorAll("[data-approve-application]").forEach((button) => {
      button.addEventListener("click", async () => {
        await apiRequest(`/merchant/technician-applications/${button.dataset.approveApplication}/approve?shopId=${session.shopId}`, {
          method: "POST",
          headers
        });
        location.reload();
      });
    });

    applicationList.querySelectorAll("[data-reject-application]").forEach((button) => {
      button.addEventListener("click", async () => {
        await apiRequest(`/merchant/technician-applications/${button.dataset.rejectApplication}/reject?shopId=${session.shopId}`, {
          method: "POST",
          headers,
          body: { reviewNote: "门店当前暂未开放名额" }
        });
        location.reload();
      });
    });
  }

  const statusButtons = Array.from(document.querySelectorAll("[data-technician-status-filter]"));
  let currentTechFilter = "in_service";

  function renderTechnicianList() {
    let filteredTechnicians = technicians;
    if (currentTechFilter === "in_service") {
      filteredTechnicians = technicians.filter((item) => item.service_status === "in_service");
    } else if (currentTechFilter === "scheduled") {
      filteredTechnicians = technicians.filter((item) => item.service_status === "available" && item.attendance_status === "on_duty");
    } else if (currentTechFilter === "resting") {
      filteredTechnicians = technicians.filter((item) => item.attendance_status === "resting");
    }

    const list = document.getElementById("technician-grid");
    if (!filteredTechnicians.length) {
      renderFallback(list, "当前筛选条件下没有技师。");
      return;
    }

    list.innerHTML = filteredTechnicians
      .slice()
      .sort((a, b) => {
        if (a.service_status === b.service_status) return a.name.localeCompare(b.name, "zh-CN");
        return a.service_status === "available" ? -1 : 1;
      })
      .map((technician) => {
        const isResting = technician.attendance_status === "resting";
        const isInService = technician.service_status === "in_service";
        const isScheduled = technician.service_status === "available" && technician.attendance_status === "on_duty";
        
        let statusText, statusClass, metaText;
        const employeeNo = technician.employee_no || technician.technician_user_id.slice(0, 3);
        if (isResting) {
          statusText = "休息";
          statusClass = "neutral";
          metaText = `工号: ${employeeNo}`;
        } else if (isInService) {
          statusText = "服务中";
          statusClass = "warning";
          const startTime = technician.active_order_start_time ? new Date(technician.active_order_start_time).getTime() : 0;
          const durationMinutes = Math.max(60, Number(technician.active_order_duration || 90));
          const endTime = startTime + durationMinutes * 60000;
          const remaining = startTime > 0 ? Math.max(0, Math.round((endTime - Date.now()) / 60000)) : durationMinutes;
          metaText = `剩余: ${remaining}min`;
        } else if (isScheduled) {
          statusText = "排钟";
          statusClass = "success";
          metaText = `工号: ${employeeNo}`;
        } else {
          statusText = "待命";
          statusClass = "success";
          metaText = `工号: ${employeeNo}`;
        }
        
        return `
          <article class="mobile-technician-row" data-technician-detail="${technician.technician_user_id}">
            <div class="mobile-technician-main">
              <div class="merchant-mobile-avatar ${isResting ? "theme-slate" : isScheduled || !isInService ? "theme-coral" : "theme-slate"}">${getInitial(technician.name)}</div>
              <div class="mobile-technician-copy">
                <h3>${technician.name}</h3>
                <div class="mobile-technician-meta">
                  <span class="mobile-status-pill ${statusClass}">${statusText}</span>
                  <span>${metaText}</span>
                </div>
              </div>
            </div>
            <label class="mobile-switch">
              <input type="checkbox" data-update-status="${technician.technician_user_id}" ${!isResting ? "checked" : ""} />
              <span></span>
            </label>
          </article>
        `;
      }).join("");

    list.querySelectorAll("[data-technician-detail]").forEach((card) => {
      card.addEventListener("click", (event) => {
        if (event.target.closest(".mobile-switch")) return;
        const target = technicians.find((item) => item.technician_user_id === card.dataset.technicianDetail);
        if (target) renderDetail(target);
      });
    });

    list.querySelectorAll("[data-update-status]").forEach((input) => {
      input.addEventListener("change", async () => {
        const technician = technicians.find((item) => item.technician_user_id === input.dataset.updateStatus);
        if (!technician) return;
        const serviceStatus = technician.service_status === "in_service" && input.checked ? "in_service" : "available";
        try {
          await apiRequest(`/merchant/technicians/${input.dataset.updateStatus}/status?shopId=${session.shopId}`, {
            method: "PATCH",
            headers,
            body: {
              attendanceStatus: input.checked ? "on_duty" : "resting",
              serviceStatus
            }
          });
          technician.attendance_status = input.checked ? "on_duty" : "resting";
          technician.service_status = serviceStatus;
          location.reload();
        } catch (error) {
          input.checked = !input.checked;
          alert(error.message);
        }
      });
    });
  }

  statusButtons.forEach((button) => {
    button.addEventListener("click", () => {
      currentTechFilter = button.dataset.technicianStatusFilter;
      statusButtons.forEach((btn) => {
        btn.classList.toggle("active", btn.dataset.technicianStatusFilter === currentTechFilter);
      });
      renderTechnicianList();
    });
  });

  renderTechnicianList();

  document.getElementById("technician-applications-toggle")?.addEventListener("click", () => openPanel(applicationPanel));
  document.getElementById("technician-applications-close")?.addEventListener("click", closePanels);
  document.getElementById("technician-detail-close")?.addEventListener("click", closePanels);
  backdrop?.addEventListener("click", closePanels);
  
  document.getElementById("technician-settlement-card")?.addEventListener("click", () => {
    location.href = "./merchant-payroll-detail.html";
  });

  async function refreshStatusData() {
    try {
      const data = await apiRequest(`/merchant/technicians?shopId=${session.shopId}`, { headers });
      const updatedTechnicians = data.technicians || [];
      if (updatedTechnicians.length > 0) {
        technicians.length = 0;
        technicians.push(...updatedTechnicians);
        renderTechnicianList();
      }
    } catch (error) {
      console.error("Failed to refresh technician status:", error.message);
    }
  }

  const refreshInterval = setInterval(refreshStatusData, 15000);

  window.addEventListener("beforeunload", () => {
    clearInterval(refreshInterval);
  });
}

export default async function init() {
  await initMerchantTechnicians();
}
