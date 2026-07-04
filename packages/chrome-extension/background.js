/* global chrome, URLSearchParams */
// Shinã Marketing IA — service worker (MV3)
// Context menu on images: save to Swipe File or open the Ad Cloner.
// Both actions open the authenticated web app with the capture as a URL
// param — no API tokens stored in the extension.

const DEFAULT_APP_URL = "https://mkt.shinaia.com.br";

chrome.runtime.onInstalled.addListener(() => {
  chrome.contextMenus.create({
    id: "shina-save-swipe",
    title: "Salvar no Swipe File (Shinã)",
    contexts: ["image"],
  });
  chrome.contextMenus.create({
    id: "shina-clone-ad",
    title: "Clonar anúncio para minha marca (Shinã)",
    contexts: ["image"],
  });
});

chrome.contextMenus.onClicked.addListener(async (info, tab) => {
  const { appUrl } = await chrome.storage.sync.get(["appUrl"]);
  const base = appUrl || DEFAULT_APP_URL;
  const imageUrl = info.srcUrl;
  if (!imageUrl) return;

  const nextIndex = (tab?.index ?? 0) + 1;

  if (info.menuItemId === "shina-clone-ad") {
    chrome.tabs.create({
      url: `${base}/cloner?source=${encodeURIComponent(imageUrl)}`,
      index: nextIndex,
    });
    return;
  }

  if (info.menuItemId === "shina-save-swipe") {
    const params = new URLSearchParams({ capture: imageUrl });
    if (info.pageUrl) params.set("from", info.pageUrl);
    chrome.tabs.create({ url: `${base}/ad-library?${params}`, index: nextIndex });
  }
});
