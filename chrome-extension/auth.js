/**
 * auth.js — Centralized Authentication & Network Request Helper
 * AI Knowledge Vault Chrome Extension
 */

const API_BASE = "http://localhost:3000/api";


// ---- Storage Helpers ----

function getAccessToken() {
  return new Promise((resolve) => {
    chrome.storage.local.get(["kv_token"], (r) => resolve(r.kv_token || null));
  });
}

function getRefreshToken() {
  return new Promise((resolve) => {
    chrome.storage.local.get(["kv_refresh_token"], (r) => resolve(r.kv_refresh_token || null));
  });
}

function setTokens(token, refreshToken) {
  return new Promise((resolve) => {
    const data = {};
    if (token) data.kv_token = token;
    if (refreshToken) data.kv_refresh_token = refreshToken;
    chrome.storage.local.set(data, resolve);
  });
}

function clearTokens() {
  return new Promise((resolve) => {
    chrome.storage.local.remove(["kv_token", "kv_refresh_token"], resolve);
  });
}


// ---- Concurrency Protection for Refresh Operation ----
let refreshPromise = null;

async function refreshAccessToken() {
  if (refreshPromise) {
    console.log("[AUTH] Refresh already in progress, waiting for existing refresh operation");
    return refreshPromise;
  }

  refreshPromise = (async () => {
    try {
      const refreshToken = await getRefreshToken();
      if (!refreshToken) {
        console.log("[AUTH] Refresh token missing in storage");
        throw new Error("No refresh token available");
      }

      console.log("[AUTH] Refreshing access token");

      const res = await fetch(`${API_BASE}/auth/refresh`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ refreshToken }),
      });

      const data = await res.json().catch(() => ({}));

      if (!res.ok) {
        console.log("[AUTH] Refresh token expired");
        throw new Error(data.message || "Refresh token expired");
      }

      const newAccessToken = data.token;
      const newRefreshToken = data.refreshToken || refreshToken;

      await setTokens(newAccessToken, newRefreshToken);
      console.log("[AUTH] Access token refreshed successfully");
      return newAccessToken;
    } catch (err) {
      console.log("[AUTH] Refresh token expired. Clearing session");
      await clearTokens();
      throw err;
    } finally {
      refreshPromise = null;
    }
  })();

  return refreshPromise;
}


/**
 * Centralized authenticated request handler with automatic token refresh
 */
async function authenticatedFetch(path, options = {}) {
  let token = await getAccessToken();

  if (!token) {
    console.log("[AUTH] User must sign in again");
    throw new Error("Session expired. Please sign in again.");
  }

  console.log(`[AUTH] Access token found`);

  const makeRequest = (authToken) => {
    const headers = {
      "Content-Type": "application/json",
      ...(options.headers || {}),
      Authorization: `Bearer ${authToken}`,
    };

    return fetch(`${API_BASE}${path}`, {
      ...options,
      headers,
    });
  };

  let res = await makeRequest(token);

  if (res.status === 401) {
    console.log("[AUTH] Request returned 401");
    console.log("[AUTH] Refreshing access token");

    try {
      const newToken = await refreshAccessToken();
      console.log("[AUTH] Retrying original request");
      res = await makeRequest(newToken);
    } catch (refreshErr) {
      console.log("[AUTH] User must sign in again");
      throw new Error("Session expired. Please sign in again.");
    }
  }

  const data = await res.json().catch(() => ({}));

  if (!res.ok) {
    if (res.status === 401) {
      console.log("[AUTH] User must sign in again");
      throw new Error("Session expired. Please sign in again.");
    } else if (res.status === 403) {
      throw new Error(data.message || "Access forbidden (403)");
    } else if (res.status === 404) {
      throw new Error(data.message || "Resource not found (404)");
    } else if (res.status >= 500) {
      throw new Error(data.message || "Server error (500). Please try again later.");
    }
    throw new Error(data.message || `Request failed (${res.status})`);
  }

  return data;
}

async function apiPost(path, body) {
  return authenticatedFetch(path, {
    method: "POST",
    body: JSON.stringify(body),
  });
}
