import { getSession, setSession, clearSession, API_BASE_URL } from "./session.js";

async function readJson(response) {
  try {
    return await response.json();
  } catch (error) {
    return null;
  }
}

export async function apiRequest(path, { method = "GET", body, headers = {} } = {}) {
  let session = getSession();

  const options = {
    method,
    headers: {
      "Content-Type": "application/json",
      ...headers
    }
  };

  if (session?.token) {
    options.headers["Authorization"] = `Bearer ${session.token}`;
  }

  if (body) {
    options.body = JSON.stringify(body);
  }

  let response;
  try {
    response = await fetch(`${API_BASE_URL}${path}`, options);
  } catch (error) {
    throw new Error(`网络连接失败，请检查 API 地址或服务状态（${API_BASE_URL}）`);
  }

  // If unauthorized and we have a refresh token, try to refresh
  if (response.status === 401 && session?.refreshToken && path !== "/auth/refresh") {
    try {
      const refreshResponse = await fetch(`${API_BASE_URL}/auth/refresh`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ refreshToken: session.refreshToken })
      });

      const refreshPayload = await readJson(refreshResponse);
      const refreshData = refreshPayload?.data || null;

      if (refreshResponse.ok && refreshData?.token && refreshData?.refreshToken) {
        // Update local session
        const newSession = {
          ...session,
          token: refreshData.token,
          refreshToken: refreshData.refreshToken
        };
        setSession(newSession);

        // Retry original request with new token
        options.headers["Authorization"] = `Bearer ${refreshData.token}`;
        response = await fetch(`${API_BASE_URL}${path}`, options);
      } else {
        // Refresh failed, logout
        clearSession();
        window.location.href = "./login.html";
        throw new Error("Session expired. Please login again.");
      }
    } catch (err) {
      clearSession();
      window.location.href = "./login.html";
      throw err;
    }
  }

  const payload = await readJson(response);

  if (!response.ok) {
    throw new Error(payload?.error?.message || payload?.message || "Request failed");
  }

  return payload?.data ?? null;
}
