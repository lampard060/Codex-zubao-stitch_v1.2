export function registerTechnicianServiceWorker() {
  const page = document.body.dataset.page || "";
  if (!page.startsWith("technician-")) return;
  if (!("serviceWorker" in navigator)) return;

  window.addEventListener("load", () => {
    navigator.serviceWorker.register("./technician-sw.js?v=20260603-homehero1").catch(() => {});
  });
}

export function initTechnicianPwa() {
  const page = document.body.dataset.page || "";
  if (!page.startsWith("technician-")) return;
  if (!("serviceWorker" in navigator)) return;
  registerTechnicianServiceWorker();

  const mainPanel = document.querySelector(".main-panel");
  if (mainPanel && !document.getElementById("technician-network-banner")) {
    const networkBanner = document.createElement("section");
    networkBanner.className = "network-status-banner";
    networkBanner.id = "technician-network-banner";
    networkBanner.hidden = navigator.onLine;
    networkBanner.innerHTML = `
      <div class="network-status-title">当前网络不可用</div>
      <div class="network-status-copy">你仍可查看已缓存页面，联网后数据会继续同步。</div>
    `;
    mainPanel.insertBefore(networkBanner, mainPanel.firstChild);

    const updateNetworkBanner = () => {
      networkBanner.hidden = navigator.onLine;
      if (navigator.onLine) {
        networkBanner.classList.add("success");
        networkBanner.querySelector(".network-status-title").textContent = "网络已恢复";
        networkBanner.querySelector(".network-status-copy").textContent = "数据连接已恢复，可继续同步最新信息。";
        window.setTimeout(() => {
          networkBanner.hidden = true;
          networkBanner.classList.remove("success");
          networkBanner.querySelector(".network-status-title").textContent = "当前网络不可用";
          networkBanner.querySelector(".network-status-copy").textContent = "你仍可查看已缓存页面，联网后数据会继续同步。";
        }, 2200);
      } else {
        networkBanner.classList.remove("success");
        networkBanner.querySelector(".network-status-title").textContent = "当前网络不可用";
        networkBanner.querySelector(".network-status-copy").textContent = "你仍可查看已缓存页面，联网后数据会继续同步。";
      }
    };

    window.addEventListener("online", updateNetworkBanner);
    window.addEventListener("offline", updateNetworkBanner);
  }
  const isStandalone = window.matchMedia("(display-mode: standalone)").matches || window.navigator.standalone === true;
  if (isStandalone) return;

  if (!mainPanel || document.getElementById("technician-pwa-banner")) return;

  let deferredPrompt = null;
  const banner = document.createElement("section");
  banner.className = "pwa-install-banner";
  banner.id = "technician-pwa-banner";
  banner.hidden = true;
  banner.innerHTML = `
    <div>
      <div class="pwa-install-title">添加到主屏幕</div>
      <div class="pwa-install-copy">将技师端保存到手机桌面，打开更快，使用更像原生应用。</div>
    </div>
    <div class="pwa-install-actions">
      <button class="ghost-button" id="technician-pwa-dismiss">稍后再说</button>
      <button class="pill-button" id="technician-pwa-install">立即添加</button>
    </div>
  `;
  mainPanel.insertBefore(banner, mainPanel.firstChild);

  const dismissButton = document.getElementById("technician-pwa-dismiss");
  const installButton = document.getElementById("technician-pwa-install");
  const dismissedKey = "zubao:technician-pwa-dismissed";

  if (!window.localStorage.getItem(dismissedKey)) {
    banner.hidden = false;
  }

  dismissButton?.addEventListener("click", () => {
    window.localStorage.setItem(dismissedKey, "1");
    banner.hidden = true;
  });

  installButton?.addEventListener("click", async () => {
    if (deferredPrompt) {
      deferredPrompt.prompt();
      const choice = await deferredPrompt.userChoice.catch(() => null);
      if (choice?.outcome === "accepted") {
        banner.hidden = true;
      }
      deferredPrompt = null;
      return;
    }
    alert("如果当前浏览器未弹出安装提示，请使用浏览器菜单中的“添加到主屏幕”完成安装。");
  });

  window.addEventListener("beforeinstallprompt", (event) => {
    event.preventDefault();
    deferredPrompt = event;
    banner.hidden = false;
  });

  window.addEventListener("appinstalled", () => {
    banner.hidden = true;
    window.localStorage.removeItem(dismissedKey);
  });
}

export function initTechnicianChrome() {
  const page = document.body.dataset.page || "";
  if (!page.startsWith("technician-")) return;

  const mainPanel = document.querySelector(".main-panel");
  let actionBanner = document.getElementById("technician-action-banner");
  if (mainPanel && !actionBanner) {
    actionBanner = document.createElement("section");
    actionBanner.className = "network-status-banner success";
    actionBanner.id = "technician-action-banner";
    actionBanner.hidden = true;
    actionBanner.innerHTML = `
      <div class="network-status-title">已为你定位到相关内容</div>
      <div class="network-status-copy">你可以继续查看当前页面的重点信息。</div>
    `;
    mainPanel.insertBefore(actionBanner, mainPanel.firstChild);
  }

  const showActionBanner = (title, copy) => {
    if (!actionBanner) return;
    actionBanner.hidden = false;
    actionBanner.classList.add("success");
    actionBanner.querySelector(".network-status-title").textContent = title;
    actionBanner.querySelector(".network-status-copy").textContent = copy;
    window.clearTimeout(showActionBanner._timer);
    showActionBanner._timer = window.setTimeout(() => {
      actionBanner.hidden = true;
    }, 2200);
  };

  document.getElementById("technician-topbar-settings")?.addEventListener("click", () => {
    if (page === "technician-profile") {
      document.getElementById("technician-profile-name-input")?.scrollIntoView({ behavior: "smooth", block: "center" });
      document.getElementById("technician-profile-name-input")?.focus();
      showActionBanner("已打开资料编辑区域", "你可以直接修改姓名、简介和擅长项目。");
      return;
    }
    location.href = "./technician-profile.html";
  });

  document.getElementById("technician-topbar-notice")?.addEventListener("click", () => {
    const targetId = page === "technician-home"
      ? "technician-home-recent-orders"
      : page === "technician-earnings"
        ? "technician-earnings-records"
        : "technician-membership-history";
    const target = document.getElementById(targetId);
    if (target) {
      target.scrollIntoView({ behavior: "smooth", block: "start" });
      showActionBanner("已定位到最近动态", "这里展示了当前页面最需要关注的记录信息。");
    }
  });
}
