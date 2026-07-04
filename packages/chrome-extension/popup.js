/* global chrome, document, setTimeout */
// Popup: persist the app URL in chrome.storage.sync.

const appUrlInput = document.getElementById("appUrl");
const saveButton = document.getElementById("save");
const okLabel = document.getElementById("ok");

chrome.storage.sync.get(["appUrl"]).then(({ appUrl }) => {
  if (appUrl) appUrlInput.value = appUrl;
});

saveButton.addEventListener("click", async () => {
  await chrome.storage.sync.set({
    appUrl: appUrlInput.value.trim() || "https://mkt.shinaia.com.br",
  });
  okLabel.style.display = "block";
  setTimeout(() => (okLabel.style.display = "none"), 2000);
});
