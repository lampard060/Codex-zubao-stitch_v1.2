import { initIconFallback } from "../utils/icon-fallback.js";
import { initBrandingAssets } from "../utils/branding.js";
import { apiRequest } from "../utils/api.js";
import { ensureTechnicianSession } from "../utils/session.js";
import { registerTechnicianServiceWorker } from "../utils/pwa.js";
import { getTechnicianMembershipStatus, renderBottomNav, renderTopbar } from "../utils/technician-shared.js?v=20260515-redesign";

let restStartTime = Date.now();
let restTimerInterval = null;

async function init() {
  initIconFallback();
  initBrandingAssets();
  registerTechnicianServiceWorker();
  renderTopbar({ variant: "rest", showBack: true });
  renderBottomNav("home", true);

  try {
    ensureTechnicianSession();
  } catch (e) {
    console.warn("缺少技师登录状态:", e);
  }

  // 加载休息开始时间
  const storedRestStart = localStorage.getItem("rest_start_time");
  if (storedRestStart) {
    restStartTime = parseInt(storedRestStart, 10);
  } else {
    localStorage.setItem("rest_start_time", restStartTime.toString());
  }

  // 开始计时
  startRestTimer();

  // 加载休息统计
  loadRestStats();

  // 绑定事件
  bindEvents();
}

function startRestTimer() {
  updateRestDuration();
  restTimerInterval = setInterval(updateRestDuration, 1000);
}

function updateRestDuration() {
  const durationEl = document.getElementById("rest-duration");
  if (!durationEl) return;

  const elapsed = Math.floor((Date.now() - restStartTime) / 1000);
  const hours = Math.floor(elapsed / 3600);
  const minutes = Math.floor((elapsed % 3600) / 60);
  const seconds = elapsed % 60;

  durationEl.textContent = `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
}

function loadRestStats() {
  const restCountEl = document.getElementById("rest-count");
  const restTotalEl = document.getElementById("rest-total");

  const todayStats = JSON.parse(localStorage.getItem("rest_stats_today") || "{\"count\":0,\"totalMinutes\":0}");

  if (restCountEl) {
    restCountEl.textContent = todayStats.count;
  }

  if (restTotalEl) {
    const hours = Math.floor(todayStats.totalMinutes / 60);
    const minutes = todayStats.totalMinutes % 60;
    restTotalEl.textContent = `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}`;
  }
}

function bindEvents() {
  const resumeWorkBtn = document.getElementById("resume-work-btn");
  if (resumeWorkBtn) {
    resumeWorkBtn.addEventListener("click", async () => {
      // 计算本次休息时长
      const elapsedMinutes = Math.floor((Date.now() - restStartTime) / 60000);

      // 更新今日统计
      const todayStats = JSON.parse(localStorage.getItem("rest_stats_today") || '{"count":0,"totalMinutes":0}');
      todayStats.count += 1;
      todayStats.totalMinutes += elapsedMinutes;
      localStorage.setItem("rest_stats_today", JSON.stringify(todayStats));

      // 清除休息开始时间
      localStorage.removeItem("rest_start_time");

      // 停止计时
      if (restTimerInterval) {
        clearInterval(restTimerInterval);
        restTimerInterval = null;
      }

      try {
        // 调用API切换状态
        await switchStatus("available");
      } catch (err) {
        console.error("切换状态失败:", err);
      }

      // 无论API是否成功都跳转到工作台
      window.location.href = "./technician-home.html";
    });
  }
}

async function switchStatus(status) {
  const session = ensureTechnicianSession();
  const technicianId = session.technicianUserId || session.user.id;

  await apiRequest("/technician/status", {
    method: "POST",
    body: {
      technicianUserId: technicianId,
      attendanceStatus: "on_duty",
      serviceStatus: status
    }
  });
}

init();

// 页面卸载时清理计时器
window.addEventListener("beforeunload", () => {
  if (restTimerInterval) {
    clearInterval(restTimerInterval);
    restTimerInterval = null;
  }
});
