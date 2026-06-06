import { ensureMerchantSession } from "../utils/session.js";
import { apiRequest } from "../utils/api.js";
import { renderFallback } from "../utils/dom.js";

const APPROVAL_IMAGES = [
  "https://lh3.googleusercontent.com/aida-public/AB6AXuAn66paY9zDqyoQVJIs82_xJyGQ16NbL35sjDtYRyNb-4U-ZOKDc6Dto2wIDUmQskIpFHtF-6jltZPci91xVYbgm1bmnfgkAwJJYaUBlNMdyFQaqdEEh4ZyEoawwzdLMStLdaf_UcgJ1EC3Sf3XHtUBfMkiPhOw1vnM1g4D7zM95BtHgS-W5msvhSP9UC5Bm7l8mBKNK8IqIvid313fejqjbEgFeK91FoaEK4HPZDkxxzujc5SsZUz6MFA-ZqCdCAAtZf8BcgXloSbe",
  "https://lh3.googleusercontent.com/aida-public/AB6AXuBTtDKKAHtwIPvAXROm2Zr-Qld9Emba2nafgXV_LaKWAnoisuSmjZpbvr-l2bqYVqqBA7tjWGYCVHukxXu408OjOj31v0I5z4Nt4wsdVuJVxftKC3beuBpRX6XCWIFrKdai3vWe62e0ZAHH_IF9t2p81xcW3aptKzL-LTULSAhiVEgDkZyFbxYomIHn8Mrid3iH3Vn4iuE0qhT0HdDEW0fwr9Laz8KrtgZXLyCyQzl36z1AaxkjesK7W4g0mrh163BE1Z_5M8e-szug",
  "https://lh3.googleusercontent.com/aida-public/AB6AXuB0VguicpcVBFMauyCxOk-bIbOsXzr-8PdQpR-2-v19KTzQWinyY4yNVA7WqClipOfnQ37as-XdP6li48uN2smUZD9Hu4_cqDlN_XOEOhhifPDDaPaIeAzdTEdNrWLYV0VmYf7gfKoId5MOMDUHGLTLexVEBI4wuXh81n-zT_kERVvv4XXnZtyj5v3nMS1j7nJomFSI_46hVLoTenYEXbCw4fmIR4iwIGDjoMIaMWToeBfkQqent61CLol3Y84zVXYMZ8AlyXuwyB2Z"
];

let currentTab = "applications";

export async function initMerchantApprovals() {
  const session = ensureMerchantSession();
  const headers = {
    "x-shop-id": session.shopId,
    "x-user-id": session.user.id
  };

  // 加载申请列表
  await loadApplications(session, headers);

  // 加载已签约技师列表
  await loadSignedTechnicians(session, headers);

  // 绑定标签切换事件
  bindTabSwitching();
}

async function loadApplications(session, headers) {
  try {
    const [joinData, leaveData] = await Promise.all([
      apiRequest(`/merchant/technician-applications?shopId=${session.shopId}`, { headers }),
      apiRequest(`/merchant/technician-leave-applications?shopId=${session.shopId}`, { headers })
    ]);
    const joinApplications = (joinData.applications || []).map((application) => ({
      ...application,
      requestType: "join"
    }));
    const leaveApplications = (leaveData.applications || []).map((application) => ({
      ...application,
      requestType: "leave"
    }));
    const applications = [...joinApplications, ...leaveApplications].sort((a, b) => {
      const statusRank = { pending: 0, rejected: 1, approved: 2 };
      const statusDiff = (statusRank[a.status] ?? 9) - (statusRank[b.status] ?? 9);
      if (statusDiff !== 0) return statusDiff;
      return new Date(b.applied_at || 0).getTime() - new Date(a.applied_at || 0).getTime();
    });
    const list = document.getElementById("approval-list");
    const joinPendingCount = joinApplications.filter((item) => item.status === "pending").length;
    const leavePendingCount = leaveApplications.filter((item) => item.status === "pending").length;
    document.getElementById("approval-summary-copy").textContent = `当前有 ${joinPendingCount} 条入驻申请、${leavePendingCount} 条解约申请待处理。请及时审核，确保门店签约关系准确。`;

    if (!applications.length) {
      renderFallback(list, "当前没有待处理申请。");
      return;
    }

    list.innerHTML = applications.map((application, index) => `
      <article class="merchant-approval-card">
        <div class="merchant-approval-head">
          <img class="merchant-approval-avatar" src="${APPROVAL_IMAGES[index % APPROVAL_IMAGES.length]}" alt="${application.name}" />
          <div class="merchant-approval-copy">
            <span class="merchant-pending-badge">${application.status === "pending" ? "待定" : application.status === "approved" ? "已通过" : "已拒绝"}</span>
            <h3 style="margin-top: 16px">${application.name}</h3>
            <div class="merchant-approval-years">${application.requestType === "leave" ? "解约申请" : `从业 ${application.years_experience || 0} 年`}</div>
          </div>
        </div>
        <p class="merchant-approval-desc">${application.requestType === "leave"
          ? `技师申请退出当前签约门店。${application.reason ? `解约原因：${application.reason}` : "未填写解约原因。"}`
          : `擅长 ${(application.specialties || []).join("、") || "传统足疗与康养护理"}，具备门店服务所需专业技能，等待审核中。`}</p>
        <div class="merchant-approval-tags">
          ${application.requestType === "leave"
            ? `<span class="merchant-approval-tag">申请解约</span>${application.reason ? `<span class="merchant-approval-tag">已填写原因</span>` : ""}`
            : (application.specialties || ["康养护理"]).slice(0, 3).map((tag) => `<span class="merchant-approval-tag">${tag}</span>`).join("")}
        </div>
        ${application.status === "pending" ? `
        <div class="merchant-approval-actions">
          <button class="merchant-reject-button" type="button" data-approval-reject="${application.id}" data-approval-type="${application.requestType}">${application.requestType === "leave" ? "驳回申请" : "拒绝"}</button>
          <button class="merchant-approve-button" type="button" data-approval-approve="${application.id}" data-approval-type="${application.requestType}">${application.requestType === "leave" ? "通过解约" : "通过申请"}</button>
        </div>
        ` : ""}
      </article>
    `).join("");

    // 绑定审核按钮事件
    list.querySelectorAll("[data-approval-approve]").forEach((button) => {
      button.addEventListener("click", async () => {
        try {
          const endpoint = button.dataset.approvalType === "leave"
            ? `/merchant/technician-leave-applications/${button.dataset.approvalApprove}/approve?shopId=${session.shopId}`
            : `/merchant/technician-applications/${button.dataset.approvalApprove}/approve?shopId=${session.shopId}`;
          await apiRequest(endpoint, {
            method: "POST",
            headers
          });
          location.reload();
        } catch (e) {
          if (e.message && e.message.includes("not found")) {
            alert("该申请已被处理，页面将刷新。");
            location.reload();
          } else {
            alert(`审核失败: ${e.message || "请重试"}`);
          }
        }
      });
    });

    list.querySelectorAll("[data-approval-reject]").forEach((button) => {
      button.addEventListener("click", async () => {
        try {
          const endpoint = button.dataset.approvalType === "leave"
            ? `/merchant/technician-leave-applications/${button.dataset.approvalReject}/reject?shopId=${session.shopId}`
            : `/merchant/technician-applications/${button.dataset.approvalReject}/reject?shopId=${session.shopId}`;
          await apiRequest(endpoint, {
            method: "POST",
            headers,
            body: { reviewNote: button.dataset.approvalType === "leave" ? "当前暂不通过解约申请，请与门店负责人沟通后重试。" : "当前门店暂未开放该岗位名额" }
          });
          location.reload();
        } catch (e) {
          if (e.message && e.message.includes("not found")) {
            alert("该申请已被处理，页面将刷新。");
            location.reload();
          } else {
            alert(`拒绝失败: ${e.message || "请重试"}`);
          }
        }
      });
    });
  } catch (error) {
    console.error("加载申请列表失败:", error);
    const list = document.getElementById("approval-list");
    renderFallback(list, "加载申请列表失败，请刷新重试。");
  }
}

async function loadSignedTechnicians(session, headers) {
  try {
    console.log("Loading signed technicians for shop:", session.shopId);
    const data = await apiRequest(`/merchant/technicians?shopId=${session.shopId}`, { headers });
    console.log("API response:", data);
    const technicians = data.technicians || [];
    console.log("Technicians count:", technicians.length);
    console.log("Technicians data:", technicians);
    
    const list = document.getElementById("signed-list");
    if (!list) {
      console.error("signed-list element not found!");
      return;
    }
    
    const summaryEl = document.getElementById("signed-summary-copy");
    if (summaryEl) {
      summaryEl.textContent = `共有 ${technicians.length} 位技师已签约。`;
    }

    if (!technicians.length) {
      console.log("No technicians found, rendering fallback");
      renderFallback(list, "暂无已签约技师。");
      return;
    }

    list.innerHTML = technicians.map((tech, index) => `
      <article class="merchant-approval-card">
        <div class="merchant-approval-head">
          <img class="merchant-approval-avatar" src="${tech.avatar_url || APPROVAL_IMAGES[index % APPROVAL_IMAGES.length]}" alt="${tech.name}" />
          <div class="merchant-approval-copy">
            <span class="merchant-pending-badge" style="background: #4ade80; color: #1a1a1a;">已签约</span>
            <h3 style="margin-top: 16px">${tech.name}</h3>
            <div class="merchant-approval-years">从业 ${tech.years_experience || 0} 年</div>
          </div>
        </div>
        <p class="merchant-approval-desc">擅长 ${(tech.specialties || []).join("、") || "传统足疗与康养护理"}，具备门店服务所需专业技能。</p>
        <div class="merchant-approval-tags">
          ${(tech.specialties || ["康养护理"]).slice(0, 3).map((tag) => `<span class="merchant-approval-tag">${tag}</span>`).join("")}
        </div>
        <div class="merchant-approval-actions">
          <button class="merchant-reject-button" type="button" data-tech-id="${tech.technician_user_id}">查看详情</button>
          <button class="merchant-approve-button" type="button" data-tech-fire="${tech.technician_user_id}" style="background: #ef4444;">解除签约</button>
        </div>
      </article>
    `).join("");

    // 绑定查看详情按钮事件
    list.querySelectorAll("[data-tech-id]").forEach((button) => {
      button.addEventListener("click", () => {
        const techId = button.dataset.techId;
        const tech = technicians.find((t) => t.technician_user_id === techId);
        if (tech) {
          showTechnicianDetailModal(tech);
        }
      });
    });

    // 绑定解除签约按钮事件
    list.querySelectorAll("[data-tech-fire]").forEach((button) => {
      button.addEventListener("click", async () => {
        const confirmed = confirm("确定要解除与该技师的签约关系吗？");
        if (!confirmed) return;
        try {
          await apiRequest(`/merchant/technicians/${button.dataset.techFire}/fire?shopId=${session.shopId}`, {
            method: "POST",
            headers
          });
          location.reload();
        } catch (e) {
          alert(`解除签约失败: ${e.message || "请重试"}`);
        }
      });
    });
  } catch (error) {
    console.error("加载已签约技师列表失败:", error);
    const list = document.getElementById("signed-list");
    renderFallback(list, "加载已签约技师列表失败，请刷新重试。");
  }
}

function showTechnicianDetailModal(tech) {
  // 创建遮罩层
  const backdrop = document.createElement("div");
  backdrop.className = "tech-modal-backdrop";
  backdrop.style.cssText = `
    position: fixed;
    inset: 0;
    background: rgba(0, 0, 0, 0.8);
    z-index: 1099;
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 24px;
  `;

  // 创建中央弹窗
  const modal = document.createElement("div");
  modal.className = "tech-modal";
  modal.style.cssText = `
    width: 100%;
    max-width: 480px;
    max-height: 80vh;
    background: #1a1a1a;
    border-radius: 20px;
    border: 1px solid rgba(242, 202, 80, 0.2);
    overflow: hidden;
    display: flex;
    flex-direction: column;
  `;

  const specialties = Array.isArray(tech.specialties) ? tech.specialties : [];
  const statusText = tech.attendance_status === 'on_duty' ? '上班中' : '休息中';
  const serviceStatusText = tech.service_status === 'in_service' ? '服务中' : tech.service_status === 'available' ? '待钟中' : '休息中';

  modal.innerHTML = `
    <div style="
      padding: 20px 24px;
      border-bottom: 1px solid rgba(255, 255, 255, 0.1);
      display: flex;
      align-items: center;
      justify-content: space-between;
    ">
      <div>
        <h2 style="
          margin: 0;
          color: #f2ca50;
          font-size: 18px;
          font-weight: 700;
        ">技师详情</h2>
        <p style="
          margin: 4px 0 0;
          color: #8f8777;
          font-size: 13px;
        ">查看技师详细信息和状态</p>
      </div>
      <button type="button" id="tech-detail-close" aria-label="关闭" style="
        width: 36px;
        height: 36px;
        border: none;
        border-radius: 50%;
        background: rgba(255, 255, 255, 0.1);
        color: #f2ca50;
        cursor: pointer;
        display: flex;
        align-items: center;
        justify-content: center;
      ">
        <span class="material-symbols-outlined" style="font-size: 20px;">close</span>
      </button>
    </div>
    <div style="
      padding: 20px 24px;
      overflow-y: auto;
      flex: 1;
    ">
      <!-- 技师头像和基本信息 -->
      <div style="
        display: flex;
        align-items: center;
        gap: 16px;
        margin-bottom: 24px;
        padding-bottom: 20px;
        border-bottom: 1px solid rgba(255, 255, 255, 0.1);
      ">
        <img src="${tech.avatar_url || APPROVAL_IMAGES[0]}" alt="${tech.name}" style="
          width: 80px;
          height: 80px;
          border-radius: 50%;
          object-fit: cover;
          border: 2px solid rgba(242, 202, 80, 0.3);
        ">
        <div>
          <h3 style="
            margin: 0 0 8px 0;
            color: #f2f0ec;
            font-size: 20px;
            font-weight: 700;
          ">${tech.name}</h3>
          <div style="
            display: flex;
            gap: 8px;
            flex-wrap: wrap;
          ">
            <span style="
              padding: 4px 12px;
              border-radius: 999px;
              background: rgba(74, 222, 128, 0.2);
              color: #4ade80;
              font-size: 12px;
              font-weight: 600;
            ">已签约</span>
            <span style="
              padding: 4px 12px;
              border-radius: 999px;
              background: rgba(242, 202, 80, 0.2);
              color: #f2ca50;
              font-size: 12px;
              font-weight: 600;
            ">${statusText}</span>
          </div>
        </div>
      </div>

      <!-- 工作信息 -->
      <div style="
        color: #f2ca50;
        font-size: 14px;
        font-weight: 600;
        margin: 20px 0 12px;
        padding-bottom: 8px;
        border-bottom: 1px solid rgba(242, 202, 80, 0.3);
      ">工作信息</div>
      ${[
        ["员工编号", tech.employee_no || "--"],
        ["从业年限", `${tech.years_experience || 0} 年`],
        ["当前状态", serviceStatusText],
        ["本月订单", `${tech.completed_order_count || 0} 单`],
        ["本月营收", `¥${((tech.month_revenue || 0) / 100).toFixed(2)}`],
        ["签约时间", tech.joined_at ? new Date(tech.joined_at).toLocaleDateString("zh-CN") : "--"]
      ].map(([label, value]) => `
        <div style="
          display: flex;
          justify-content: space-between;
          align-items: center;
          padding: 10px 0;
          border-bottom: 1px solid rgba(255, 255, 255, 0.05);
        ">
          <span style="
            color: #8f8777;
            font-size: 14px;
          ">${label}</span>
          <span style="
            color: #f2f0ec;
            font-size: 14px;
            font-weight: 500;
            text-align: right;
          ">${value}</span>
        </div>
      `).join('')}

      <!-- 个人信息 -->
      <div style="
        color: #f2ca50;
        font-size: 14px;
        font-weight: 600;
        margin: 24px 0 12px;
        padding-bottom: 8px;
        border-bottom: 1px solid rgba(242, 202, 80, 0.3);
      ">个人信息</div>
      ${[
        ["性别", tech.gender === 'male' ? '男' : tech.gender === 'female' ? '女' : tech.gender || "--"],
        ["出生年月", tech.birth_date ? new Date(tech.birth_date).toLocaleDateString("zh-CN", {year: 'numeric', month: 'long'}) : "--"],
        ["手机号", tech.phone || "--"],
        ["身份证号", tech.id_card || "--"],
        ["家庭住址", tech.address || "--"]
      ].map(([label, value]) => `
        <div style="
          display: flex;
          justify-content: space-between;
          align-items: center;
          padding: 10px 0;
          border-bottom: 1px solid rgba(255, 255, 255, 0.05);
        ">
          <span style="
            color: #8f8777;
            font-size: 14px;
          ">${label}</span>
          <span style="
            color: #f2f0ec;
            font-size: 14px;
            font-weight: 500;
            text-align: right;
          ">${value}</span>
        </div>
      `).join('')}

      <!-- 紧急联系人 -->
      ${(tech.emergency_contact_name || tech.emergency_contact_phone) ? `
      <div style="
        color: #f2ca50;
        font-size: 14px;
        font-weight: 600;
        margin: 24px 0 12px;
        padding-bottom: 8px;
        border-bottom: 1px solid rgba(242, 202, 80, 0.3);
      ">紧急联系人</div>
      ${[
        ["联系人", tech.emergency_contact_name || "--"],
        ["联系电话", tech.emergency_contact_phone || "--"]
      ].map(([label, value]) => `
        <div style="
          display: flex;
          justify-content: space-between;
          align-items: center;
          padding: 10px 0;
          border-bottom: 1px solid rgba(255, 255, 255, 0.05);
        ">
          <span style="
            color: #8f8777;
            font-size: 14px;
          ">${label}</span>
          <span style="
            color: #f2f0ec;
            font-size: 14px;
            font-weight: 500;
            text-align: right;
          ">${value}</span>
        </div>
      `).join('')}
      ` : ''}

      <!-- 专业技能标签 -->
      <div style="margin-top: 20px;">
        <div style="
          color: #8f8777;
          font-size: 14px;
          margin-bottom: 12px;
        ">专业技能</div>
        <div style="
          display: flex;
          gap: 8px;
          flex-wrap: wrap;
        ">
          ${specialties.length > 0 ? specialties.map((tag) => `
            <span style="
              padding: 6px 14px;
              border-radius: 999px;
              background: rgba(242, 202, 80, 0.15);
              color: #f2ca50;
              font-size: 13px;
              font-weight: 500;
            ">${tag}</span>
          `).join("") : '<span style="color: #8f8777; font-size: 13px;">暂无专业技能标签</span>'}
        </div>
      </div>

      <!-- 个人简介 -->
      ${tech.bio ? `
      <div style="margin-top: 20px;">
        <div style="
          color: #8f8777;
          font-size: 14px;
          margin-bottom: 12px;
        ">个人简介</div>
        <p style="
          margin: 0;
          color: #f2f0ec;
          font-size: 14px;
          line-height: 1.6;
          padding: 16px;
          background: rgba(255, 255, 255, 0.05);
          border-radius: 12px;
        ">${tech.bio}</p>
      </div>
      ` : ''}
    </div>
  `;

  backdrop.appendChild(modal);
  document.body.appendChild(backdrop);

  const closeModal = () => {
    backdrop.remove();
  };

  modal.querySelector("#tech-detail-close").addEventListener("click", closeModal);
  backdrop.addEventListener("click", (e) => {
    if (e.target === backdrop) closeModal();
  });
}

function bindTabSwitching() {
  const tabs = document.querySelectorAll(".merchant-tab");
  const applicationsSection = document.getElementById("applications-section");
  const signedSection = document.getElementById("signed-section");

  tabs.forEach((tab) => {
    tab.addEventListener("click", () => {
      const targetTab = tab.dataset.tab;
      if (targetTab === currentTab) return;

      currentTab = targetTab;

      // 更新标签样式
      tabs.forEach((t) => {
        const isActive = t.dataset.tab === targetTab;
        t.classList.toggle("active", isActive);
        t.style.background = isActive ? "#f2ca50" : "rgba(255, 255, 255, 0.1)";
        t.style.color = isActive ? "#1a1a1a" : "#8f8777";
      });

      // 切换内容显示
      if (targetTab === "applications") {
        applicationsSection.style.display = "";
        signedSection.style.display = "none";
      } else {
        applicationsSection.style.display = "none";
        signedSection.style.display = "";
      }
    });
  });
}

export default async function init() {
  await initMerchantApprovals();
}
