/* eslint-disable no-restricted-globals */
/**
 * UPWA-ISMS service worker.
 *
 * The app is a school platform people reach from phones on patchy networks, so
 * the shell, the pages already visited and the imagery are kept on the device.
 * The rules are deliberately conservative:
 *
 *   navigations          network first, then the cached copy, then /offline
 *   /_next/static/**     cache first — these files are content-hashed, so a
 *                        cached copy is always the exact build that asked for it
 *   /api/** (GET only)   network first, last-known answer kept for offline
 *   everything else      stale-while-revalidate (icons, imagery, fonts)
 *
 * Nothing else is intercepted: no cross-origin requests, no POSTs, so forms,
 * uploads and the President's dispatch route always reach the server.
 *
 * Bump VERSION whenever the precached shell list changes; hashed assets and
 * network-first pages pick up new deploys on their own.
 */
const VERSION = "upwa-v1";
const SHELL = `${VERSION}-shell`;
const PAGES = `${VERSION}-pages`;
const ASSETS = `${VERSION}-assets`;
const DATA = `${VERSION}-data`;

const PRECACHE = [
  "/",
  "/offline",
  "/manifest.webmanifest",
  "/icons/icon-192.png",
  "/icons/icon-512.png",
  "/icons/icon-maskable-512.png",
  "/icons/apple-touch-icon.png",
  "/icons/favicon-32.png",
  "/upwa-logo.png",
  "/dr-chinwe-chike.jpg",
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    (async () => {
      const cache = await caches.open(SHELL);
      // Individual failures must not sink the whole install.
      await Promise.allSettled(PRECACHE.map((path) => cache.add(path)));
      await self.skipWaiting();
    })(),
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    (async () => {
      const keep = new Set([SHELL, PAGES, ASSETS, DATA]);
      const keys = await caches.keys();
      await Promise.all(keys.filter((key) => !keep.has(key)).map((key) => caches.delete(key)));
      await self.clients.claim();
      const clients = await self.clients.matchAll({ type: "window" });
      clients.forEach((client) => client.postMessage({ type: "UPWA_SW_ACTIVATED", version: VERSION }));
    })(),
  );
});

self.addEventListener("message", (event) => {
  if (event.data === "SKIP_WAITING") self.skipWaiting();
});

/** Keep a cache from growing without bound; keys() is in insertion order. */
async function trim(cacheName, max) {
  const cache = await caches.open(cacheName);
  const keys = await cache.keys();
  if (keys.length <= max) return;
  await Promise.all(keys.slice(0, keys.length - max).map((key) => cache.delete(key)));
}

async function remember(cacheName, request, response, max) {
  if (!response || response.status !== 200 || response.type !== "basic") return;
  const cache = await caches.open(cacheName);
  await cache.put(request, response.clone());
  if (max) trim(cacheName, max);
}

async function networkFirst(request, cacheName, max) {
  try {
    const fresh = await fetch(request);
    await remember(cacheName, request, fresh, max);
    return fresh;
  } catch (error) {
    const cache = await caches.open(cacheName);
    const stored = await cache.match(request);
    if (stored) return stored;
    throw error;
  }
}

async function cacheFirst(request, cacheName, max) {
  const cache = await caches.open(cacheName);
  const stored = await cache.match(request);
  if (stored) return stored;
  const fresh = await fetch(request);
  await remember(cacheName, request, fresh, max);
  return fresh;
}

self.addEventListener("fetch", (event) => {
  const request = event.request;
  const url = new URL(request.url);
  if (request.method !== "GET" || url.origin !== self.location.origin) return;
  if (url.pathname === "/sw.js") return;

  event_waitUntil = (promise) => event.waitUntil(promise);

  if (request.mode === "navigate") {
    event.respondWith(
      (async () => {
        try {
          const fresh = await fetch(request);
          remember(PAGES, request, fresh, 40);
          return fresh;
        } catch (error) {
          const cache = await caches.open(PAGES);
          const stored = await cache.match(request);
          if (stored) return stored;
          const shell = await caches.open(SHELL);
          return (await shell.match("/offline")) || Response.error();
        }
      })(),
    );
    return;
  }

  if (url.pathname.startsWith("/_next/static/")) {
    event.respondWith(cacheFirst(request, ASSETS, 120));
    return;
  }

  if (url.pathname.startsWith("/api/")) {
    event.respondWith(networkFirst(request, DATA, 40));
    return;
  }

  // Imagery, icons and fonts: answer from the device at once, and refresh the
  // copy behind the response. waitUntil is called synchronously, as the spec
  // requires; the background refresh outlives the response.
  const refresh = fetch(request)
    .then((fresh) => remember(ASSETS, request, fresh, 120))
    .catch(() => undefined);
  event.waitUntil(refresh);
  event.respondWith(
    caches.open(ASSETS).then((cache) =>
      cache
        .match(request)
        .then((stored) => stored || refresh.then(() => cache.match(request)).then((again) => again || Response.error())),
    ),
  );
});
