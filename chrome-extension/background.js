/**
 * background.js — AI Knowledge Vault Chrome Extension
 * Service worker: sets up context menu for saving selected text and webpages.
 */

importScripts("auth.js");


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
  const token = await getAccessToken();

  if (!token) {
    console.log("[AUTH] User must sign in again — context menu clicked with no token");
    chrome.notifications.create({
      type: "basic",
      iconUrl: "icons/icon-48.png",
      title: "Knowledge Vault — Authentication Required",
      message: "Session expired. Please sign in again.",
    });
    return;
  }

  if (info.menuItemId === "save-selection" && info.selectionText) {
    try {
      await apiPost("/knowledge", {
        title: tab.title?.substring(0, 80) || "Selected Text",
        content: info.selectionText.substring(0, 8000),
        sourceType: "article",
        sourceUrl: tab.url || "",
      });

      chrome.notifications.create({
        type: "basic",
        iconUrl: "icons/icon-48.png",
        title: "Knowledge Vault",
        message: "Selection saved to your vault!",
      });
    } catch (err) {
      console.error("[AUTH] Context menu save selection error:", err.message);
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
      await apiPost("/knowledge/import/url", { url });

      chrome.notifications.create({
        type: "basic",
        iconUrl: "icons/icon-48.png",
        title: "Knowledge Vault",
        message: "Page saved to your vault!",
      });
    } catch (err) {
      console.error("[AUTH] Context menu save page error:", err.message);
      chrome.notifications.create({
        type: "basic",
        iconUrl: "icons/icon-48.png",
        title: "Knowledge Vault — Error",
        message: err.message,
      });
    }
  }
});
