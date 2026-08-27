/**
 * background.js — AI Knowledge Vault Chrome Extension
 * Service worker: sets up context menu for saving selected text.
 */

const API_BASE = "http://localhost:3000/api";


// ---- Create context menu on install ----

chrome.runtime.onInstalled.addListener(() => {
  chrome.contextMenus.create({
    id: "save-selection",
    title: "Save to Knowledge Vault",
    contexts: ["selection"],
  });

  chrome.contextMenus.create({
    id: "save-page",
    title: "Save Page to Knowledge Vault",
    contexts: ["page", "link"],
  });
});


// ---- Context menu click handler ----

chrome.contextMenus.onClicked.addListener(async (info, tab) => {
  const token = await getToken();

  if (!token) {
    chrome.notifications.create({
      type: "basic",
      iconUrl: "icons/icon-48.png",
      title: "Knowledge Vault",
      message: "Please sign in to the extension first.",
    });
    return;
  }

  if (info.menuItemId === "save-selection" && info.selectionText) {
    try {
      await apiPost(
        "/knowledge",
        {
          title: tab.title?.substring(0, 80) || "Selected Text",
          content: info.selectionText.substring(0, 8000),
          sourceType: "article",
          sourceUrl: tab.url || "",
        },
        token
      );

      chrome.notifications.create({
        type: "basic",
        iconUrl: "icons/icon-48.png",
        title: "Knowledge Vault",
        message: "Selection saved to your vault!",
      });
    } catch (err) {
      chrome.notifications.create({
        type: "basic",
        iconUrl: "icons/icon-48.png",
        title: "Knowledge Vault — Error",
        message: err.message,
      });
    }
  }

  if (info.menuItemId === "save-page") {
    const url = info.linkUrl || tab?.url;
    if (!url) return;

    try {
      await apiPost("/knowledge/import/url", { url }, token);

      chrome.notifications.create({
        type: "basic",
        iconUrl: "icons/icon-48.png",
        title: "Knowledge Vault",
        message: "Page saved to your vault!",
      });
    } catch (err) {
      chrome.notifications.create({
        type: "basic",
        iconUrl: "icons/icon-48.png",
        title: "Knowledge Vault — Error",
        message: err.message,
      });
    }
  }
});


// ---- Helpers ----

function getToken() {
  return new Promise((resolve) => {
    chrome.storage.local.get(["kv_token"], (r) => resolve(r.kv_token || null));
  });
}

async function apiPost(path, body, token) {
  const res = await fetch(`${API_BASE}${path}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(body),
  });

  const data = await res.json();

  if (!res.ok) {
    throw new Error(data.message || `Error ${res.status}`);
  }

  return data;
}
