/* Service worker of the 合言葉大富豪 PWA. Generated from sw.template.js by dist_build.py. */
"use strict";
const VERSION = "043437dea5fd";
const CACHE = "dfg-" + VERSION;
const SHELL = ["./", "app.css?v=043437dea5fd", "app.js?v=043437dea5fd", "icons/apple-touch-icon.png", "icons/favicon-32.png", "icons/icon-192.png", "icons/icon-512.png", "icons/icon-maskable-512.png", "index.html", "manifest.webmanifest", "peerjs.min.js?v=043437dea5fd", "pwa.js?v=043437dea5fd"];
const SCOPE = self.registration.scope;

self.addEventListener("install", (e) => {
  // No skipWaiting() here: a new worker waits until the page asks for it (never mid-game).
  e.waitUntil((async () => {
    const cache = await caches.open(CACHE);
    // cache:"reload" bypasses the HTTP cache so a stale GitHub Pages copy is never precached.
    await Promise.all(SHELL.map(async (u) => {
      const res = await fetch(new Request(new URL(u, SCOPE), { cache: "reload" }));
      if (!res.ok) throw new Error("precache failed: " + u + " " + res.status);
      await cache.put(new Request(new URL(u, SCOPE)), res);
    }));
  })());
});

self.addEventListener("activate", (e) => {
  e.waitUntil((async () => {
    for (const k of await caches.keys()) if (k.startsWith("dfg-") && k !== CACHE) await caches.delete(k);
    await self.clients.claim();
  })());
});

self.addEventListener("message", (e) => {
  const d = e.data || {};
  if (d.type === "SKIP_WAITING") self.skipWaiting();
  else if (d.type === "GET_VERSION" && e.source) e.source.postMessage({ type: "VERSION", version: VERSION });
});

self.addEventListener("fetch", (e) => {
  const req = e.request;
  if (req.method !== "GET") return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return; // never touch cross-origin (PeerJS signalling etc.)
  if (!url.href.startsWith(SCOPE)) return;
  e.respondWith((async () => {
    const cache = await caches.open(CACHE);
    if (req.mode === "navigate") {
      return (await cache.match(new URL("index.html", SCOPE), { ignoreSearch: true })) || fetch(req);
    }
    const hit = await cache.match(req, { ignoreSearch: true });
    return hit || fetch(req);
  })());
});
