/**
 * content.js — AI Knowledge Vault Content Script
 * Captures webpage text, meta description, and active selection.
 */

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === "getPageDetails") {
    const selectionText = window.getSelection() ? window.getSelection().toString().trim() : "";
    const metaDesc =
      document.querySelector('meta[name="description"]')?.content ||
      document.querySelector('meta[property="og:description"]')?.content ||
      "";

    sendResponse({
      title: document.title || "",
      url: window.location.href || "",
      selectionText,
      metaDescription: metaDesc,
    });
  }
  return true;
});
