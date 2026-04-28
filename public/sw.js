// Keep Informed — minimal service worker.
// v1 ships no offline cache. The SW exists so the app meets PWA install
// criteria and so we have a place to add caching/push later without a
// breaking re-registration.

const VERSION = "v1-2026-04-28";

self.addEventListener("install", (event) => {
  // Activate immediately on first install or version bump.
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(self.clients.claim());
});

// Pass-through fetch handler. Required for installability on some
// browsers; without a fetch listener the browser may treat the SW as
// a no-op and skip the install prompt.
self.addEventListener("fetch", () => {});
