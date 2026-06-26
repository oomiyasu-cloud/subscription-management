const CACHE_NAME = "subscription-management-v18";
const APP_SHELL = [
  "./",
  "./index.html",
  "./manifest.webmanifest",
  "./app-icon.svg",
  "./src/main.js?v=history-select-20260626",
  "./src/backup.js?v=backup-20260626",
  "./src/cloudConfig.js",
  "./src/cloudStorage.js",
  "./src/ui.js",
  "./src/models.js?v=submit-fix-20260626",
  "./src/storage.js",
  "./src/selectors.js",
  "./src/calculations.js",
  "./src/styles.css?v=history-select-20260626"
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(CACHE_NAME)
      .then((cache) => cache.addAll(APP_SHELL))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key))))
      .then(() => clients.claim())
  );
});

self.addEventListener("fetch", (event) => {
  if (event.request.method !== "GET") {
    return;
  }

  if (event.request.mode === "navigate") {
    event.respondWith(fetch(event.request).catch(() => caches.match("./index.html")));
    return;
  }

  event.respondWith(
    fetch(event.request)
      .then((response) => {
        const responseCopy = response.clone();
        caches.open(CACHE_NAME).then((cache) => cache.put(event.request, responseCopy));
        return response;
      })
      .catch(() => caches.match(event.request))
  );
});
