/*
 * PerDiem service worker — deliberately minimal. Registered in production only, by
 * components/perdiem/install-app.tsx.
 *
 * It caches NOTHING and has NO fetch handler:
 *  - PerDiem shows live financial data behind HTTP Basic auth (budgets, ledger entries, settlement
 *    states). A cached page or API response could show a stale balance, or a payment as "pending"
 *    after it settled, so nothing is ever stored here.
 *  - Chrome and Edge on desktop (since version 112) no longer require a service worker or a fetch
 *    handler to offer installation; the manifest is enough. A pass-through `fetch` listener would
 *    add a worker start-up in front of every request for no benefit, and a worker that fetches
 *    navigations itself can swallow the Basic-auth challenge (the 401 reaches the page with no
 *    login dialog). Without a fetch listener the browser never routes requests through this
 *    worker: everything goes to the network exactly as if no worker were installed.
 *
 * To retire it later, ship a version that calls self.registration.unregister() in `activate`
 * (a 404 leaves the old worker installed).
 */
self.addEventListener("install", () => {
  // Take over from an older version immediately; there is no cache to warm.
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(self.clients.claim());
});
