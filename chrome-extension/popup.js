/**
 * popup.js — AI Knowledge Vault Chrome Extension
 * Connects directly to the existing backend API.
 */

const API_BASE = "http://localhost:3000/api";


// ---- Storage helpers ----

function getToken() {
  return new Promise((resolve) => {
    chrome.storage.local.get(["kv_token"], (r) => resolve(r.kv_token || null));
  });
}

function setToken(token) {
  return new Promise((resolve) => {
    chrome.storage.local.set({ kv_token: token }, resolve);
  });
}

function clearToken() {
  return new Promise((resolve) => {
    chrome.storage.local.remove(["kv_token"], resolve);
  });
}

function showStatus(elementId, message, type = "success") {
  const el = document.getElementById(elementId);
  if (!el) return;
  el.className = `status-msg ${type}`;
  el.textContent = message;
}


async function apiPost(path, body, token) {
  console.log(`[EXTENSION DEBUG] API URL: ${API_BASE}${path}`);
  console.log(`[EXTENSION DEBUG] Request Body:`, body);

  const res = await fetch(`${API_BASE}${path}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(body),
  });

  console.log(`[EXTENSION DEBUG] Response status: ${res.status}`);

  const data = await res.json();

  if (!res.ok) {
    throw new Error(data.message || `Error ${res.status}`);
  }

  return data;
}


function isYouTube(url) {
  return (
    url.includes("youtube.com/watch") ||
    url.includes("youtu.be/") ||
    url.includes("youtube.com/shorts/")
  );
}


// ---- Init ----

async function init() {
  const token = await getToken();

  if (!token) {
    document.getElementById("not-logged-in").style.display = "block";
    return;
  }

  document.getElementById("logged-in").style.display = "block";

  // Get current active tab
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });

  if (tab) {
    document.getElementById("page-title").textContent = tab.title || "Untitled Page";
    document.getElementById("page-url").textContent = tab.url || "";

    if (isYouTube(tab.url || "")) {
      document.getElementById("save-youtube-btn").style.display = "flex";
    }
  }
}


// ---- Sign In ----

document.getElementById("login-btn")?.addEventListener("click", async () => {
  const email = document.getElementById("email").value.trim();
  const password = document.getElementById("password").value;

  if (!email || !password) {
    showStatus("auth-status", "Email and password are required.", "error");
    return;
  }

  showStatus("auth-status", "Signing in...", "loading");

  try {
    const res = await fetch(`${API_BASE}/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password }),
    });

    const data = await res.json();

    if (!res.ok) {
      throw new Error(data.message || "Login failed");
    }

    await setToken(data.token);
    window.location.reload();

  } catch (err) {
    showStatus("auth-status", err.message, "error");
  }
});


// ---- Save Webpage / Article ----

document.getElementById("save-url-btn")?.addEventListener("click", async () => {
  const token = await getToken();
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  const userNote = document.getElementById("user-note")?.value.trim();

  if (!tab?.url) return;

  showStatus("status-msg", "Extracting article & generating AI summary...", "loading");

  try {
    const data = await apiPost("/knowledge/import/url", { url: tab.url }, token);

    if (userNote) {
      await apiPost("/knowledge", {
        title: `Note on: ${tab.title?.substring(0, 60)}`,
        content: userNote,
        sourceType: "note",
        sourceUrl: tab.url,
      }, token).catch(() => {});
    }

    showStatus("status-msg", "✓ Saved to your Knowledge Vault!", "success");
  } catch (err) {
    showStatus("status-msg", err.message, "error");
  }
});


// ---- Save YouTube Video ----

document.getElementById("save-youtube-btn")?.addEventListener("click", async () => {
  const token = await getToken();
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  const userNote = document.getElementById("user-note")?.value.trim();

  if (!tab?.url) return;

  showStatus("status-msg", "Extracting video transcript & generating AI summary...", "loading");

  try {
    await apiPost("/knowledge/import/youtube", { url: tab.url }, token);

    if (userNote) {
      await apiPost("/knowledge", {
        title: `Note on Video: ${tab.title?.substring(0, 60)}`,
        content: userNote,
        sourceType: "note",
        sourceUrl: tab.url,
      }, token).catch(() => {});
    }

    showStatus("status-msg", "✓ YouTube video saved to vault!", "success");
  } catch (err) {
    showStatus("status-msg", err.message, "error");
  }
});


// ---- Save Selected Text ----

document.getElementById("save-selection-btn")?.addEventListener("click", async () => {
  const token = await getToken();
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  const userNote = document.getElementById("user-note")?.value.trim();

  let selectedText = "";
  try {
    const results = await chrome.scripting.executeScript({
      target: { tabId: tab.id },
      func: () => window.getSelection().toString(),
    });
    selectedText = results?.[0]?.result?.trim() || "";
  } catch {
    // ignore
  }

  if (!selectedText && !userNote) {
    showStatus("status-msg", "No text selected. Highlight text or enter a personal note.", "error");
    return;
  }

  showStatus("status-msg", "Saving content to vault...", "loading");

  const fullContent = [
    userNote ? `Note: ${userNote}` : "",
    selectedText ? `Selected Text:\n${selectedText}` : "",
  ].filter(Boolean).join("\n\n");

  try {
    await apiPost(
      "/knowledge",
      {
        title: tab.title?.substring(0, 80) || "Saved Selection",
        content: fullContent.substring(0, 8000),
        sourceType: "article",
        sourceUrl: tab.url,
      },
      token
    );
    showStatus("status-msg", "✓ Selection saved to vault!", "success");
  } catch (err) {
    showStatus("status-msg", err.message, "error");
  }
});


// ---- Sign out ----

document.getElementById("logout-btn")?.addEventListener("click", async () => {
  await clearToken();
  window.location.reload();
});


// Init popup
init();
