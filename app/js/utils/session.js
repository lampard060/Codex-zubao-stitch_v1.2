const API_BASE_OVERRIDE_KEY = "zubao_api_base_url";

function normalizeApiBase(input) {
  if (!input || typeof input !== "string") return null;
  const trimmed = input.trim().replace(/\/+$/, "");
  if (!trimmed) return null;
  return `${trimmed}/api/v1`;
}

function resolveApiBaseUrl() {
  const queryBase = new URLSearchParams(window.location.search).get("apiBase");
  if (queryBase) {
    const normalized = normalizeApiBase(queryBase);
    if (normalized) {
      localStorage.setItem(API_BASE_OVERRIDE_KEY, queryBase.trim().replace(/\/+$/, ""));
      return normalized;
    }
  }

  const savedBase = normalizeApiBase(localStorage.getItem(API_BASE_OVERRIDE_KEY) || "");
  if (savedBase) return savedBase;

  const protocol = window.location.protocol === "https:" ? "https:" : "http:";
  const host = window.location.hostname || "127.0.0.1";
  return `${protocol}//${host}:3001/api/v1`;
}

export const API_BASE_URL = resolveApiBaseUrl();

export const STORAGE_KEY = "zubao_session";

export const DEFAULT_SHOP_ID = "30000000-0000-0000-0000-000000000001";
const PREVIEW_QUERY_KEY = "preview";

function isPreviewMode() {
  try {
    return new URLSearchParams(window.location.search).get(PREVIEW_QUERY_KEY) === "1";
  } catch (error) {
    return false;
  }
}

function createPreviewSession(role) {
  return {
    token: "preview-token",
    technicianUserId: role === "technician" ? "preview-technician" : undefined,
    user: {
      id: role === "technician" ? "preview-technician" : "preview-merchant",
      role,
      name: role === "technician" ? "预览技师" : "预览商家"
    }
  };
}

export function getSession() {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY) || "null");
  } catch (error) {
    return null;
  }
}

export function setSession(session) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(session));
}

export function clearSession() {
  localStorage.removeItem(STORAGE_KEY);
  localStorage.removeItem("zubao-session");
  sessionStorage.removeItem("zubao-session");
  sessionStorage.removeItem("zubao_session");
}

export function getHomePathByRole(role) {
  if (role === "merchant") return "./merchant-dashboard.html";
  if (role === "technician") return "./technician-home.html";
  return "./login.html";
}

export function ensureMerchantSession() {
  if (isPreviewMode()) {
    return createPreviewSession("merchant");
  }
  const session = getSession();
  if (!session?.token || session?.user?.role !== "merchant") {
    location.href = "./login.html";
    throw new Error("Missing merchant session");
  }
  return session;
}

export function ensureTechnicianSession() {
  if (isPreviewMode()) {
    return createPreviewSession("technician");
  }
  const session = getSession();
  if (!session?.token || session?.user?.role !== "technician") {
    location.href = "./login.html";
    throw new Error("Missing technician session");
  }
  return session;
}
