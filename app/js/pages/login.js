import { setSession, DEFAULT_SHOP_ID } from "../utils/session.js";
import { apiRequest } from "../utils/api.js";
import { formatCurrency, formatAmountInputValue, parseAmountInputValue, normalizeAmountInputElement, bindAmountInputNormalization, formatMonth, formatDateTime, toDateTimeLocalValue, getInitial } from "../utils/format.js";
import { showFieldFeedback, downloadTextFile, renderFallback } from "../utils/dom.js";

export const POST_LOGIN_REDIRECT_KEY = "zubao_post_login_redirect";

function readSafePostLoginRedirect() {
  const redirect = sessionStorage.getItem(POST_LOGIN_REDIRECT_KEY);
  if (!redirect) return null;

  try {
    const target = new URL(redirect, window.location.href);
    if (target.origin !== window.location.origin) return null;
    return target.href;
  } catch (error) {
    return null;
  }
}

function consumePostLoginRedirect() {
  const redirect = readSafePostLoginRedirect();
  if (redirect) {
    sessionStorage.removeItem(POST_LOGIN_REDIRECT_KEY);
  }
  return redirect;
}

function setLoginPending(role, isPending) {
  const button = document.getElementById(`${role}-login-button`);
  const phoneInput = document.getElementById(`${role}-phone`);
  const passwordInput = document.getElementById(`${role}-password`);
  const toggle = document.querySelector(`[data-password-toggle="${role}-password"]`);

  if (button) {
    button.disabled = isPending;
    button.textContent = isPending ? "登录中..." : "立即登录";
    button.setAttribute("aria-busy", isPending ? "true" : "false");
  }

  [phoneInput, passwordInput, toggle].forEach((element) => {
    if (element) element.disabled = isPending;
  });
}

export async function handleLogin(role) {
  const phoneInput = document.getElementById(`${role}-phone`);
  const passwordInput = document.getElementById(`${role}-password`);
  const feedback = document.getElementById("login-feedback");
  if (feedback) {
    feedback.hidden = true;
    feedback.textContent = "";
  }

  try {
    setLoginPending(role, true);

    const data = await apiRequest("/auth/login", {
      method: "POST",
      body: {
        phone: phoneInput.value.trim(),
        password: passwordInput.value
      }
    });

    const session = {
      token: data.token,
      refreshToken: data.refreshToken,
      user: data.user,
      membership: data.membership,
      shopId: data.membership?.shop_id || DEFAULT_SHOP_ID,
      technicianUserId: data.user?.role === "technician" ? data.user.id : null
    };

    setSession(session);

    const redirect = consumePostLoginRedirect();
    if (redirect && role === "technician") {
      location.href = redirect;
      return;
    }

    if (role === "merchant") {
      location.href = "./merchant-dashboard.html";
      return;
    }

    location.href = "./technician-home.html";
  } catch (error) {
    if (feedback) {
      feedback.hidden = false;
      feedback.textContent = error.message;
    }
    alert(error.message);
  } finally {
    setLoginPending(role, false);
  }
}

export function initLoginPage() {
  // 自动清理所有可能的旧 Session 数据
  const oldSession1 = localStorage.getItem("zubao-session");
  const oldSession2 = sessionStorage.getItem("zubao-session");
  const oldSession3 = sessionStorage.getItem("zubao_session");
  if (oldSession1 || oldSession2 || oldSession3) {
    localStorage.removeItem("zubao-session");
    sessionStorage.removeItem("zubao-session");
    sessionStorage.removeItem("zubao_session");
  }

  document.getElementById("merchant-login-button")?.addEventListener("click", () => handleLogin("merchant"));
  document.getElementById("technician-login-button")?.addEventListener("click", () => handleLogin("technician"));

  const preferredRole = new URLSearchParams(window.location.search).get("role");
  if (preferredRole) {
    document.querySelector(`[data-role-tabs="login"] [data-role="${preferredRole}"]`)?.click();
  }
}

export default async function init() {
  await initLoginPage();
}
