import { getSession, clearSession } from "./session.js";
import { apiRequest } from "./api.js";

export function showFieldFeedback(elementId, message, isError = false) {
  const element = document.getElementById(elementId);
  if (!element) return;
  element.hidden = !message;
  element.textContent = message || "";
  element.style.color = isError ? "#b42318" : "var(--primary)";
}

export function downloadTextFile(filename, content, mimeType = "text/plain;charset=utf-8") {
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

export function renderFallback(container, message) {
  if (!container) return;
  container.innerHTML = `<div class="small" style="padding: 18px 0; color: var(--on-surface-variant)">${message}</div>`;
}

export function bindRoleTabs() {
  document.querySelectorAll("[data-role-tabs]").forEach((container) => {
    const panels = document.querySelectorAll(`[data-role-panel="${container.dataset.roleTabs}"]`);
    container.querySelectorAll("button").forEach((button) => {
      button.addEventListener("click", () => {
        container.querySelectorAll("button").forEach((item) => item.classList.remove("active"));
        panels.forEach((panel) => {
          panel.hidden = panel.dataset.role !== button.dataset.role;
        });
        button.classList.add("active");
      });
    });
  });
}

export function bindApplicationToggles() {
  document.querySelectorAll("[data-application-toggle]").forEach((button) => {
    button.addEventListener("click", () => {
      const target = document.querySelector(button.dataset.applicationToggle);
      if (!target) return;
      target.scrollIntoView({ behavior: "smooth", block: "start" });
    });
  });
}

export function injectLogoutAction() {
  const session = getSession();
  if (!session?.token || document.body.dataset.page === "login") {
    return;
  }

  const topbarActions = document.querySelector(".topbar-actions");
  if (!topbarActions || topbarActions.querySelector("[data-logout-button]")) {
    return;
  }

  const logoutButton = document.createElement("button");
  logoutButton.className = "ghost-button";
  logoutButton.dataset.logoutButton = "true";
  logoutButton.textContent = "退出登录";
  logoutButton.addEventListener("click", async () => {
    try {
      const session = getSession();
      if (session?.refreshToken) {
        await apiRequest("/auth/logout", {
          method: "POST",
          body: { refreshToken: session.refreshToken }
        });
      }
    } catch (error) {
      console.warn("Logout request failed:", error);
    } finally {
      clearSession();
      location.href = "./login.html";
    }
  });
  topbarActions.prepend(logoutButton);
}
