/* Minimal app-shell cache: the demo opens offline after the first visit.
   Every branch resolves to a Response, so a navigation can never fail inside the worker. */
const CACHE = "flowline-demo-v2";
const SHELL = new URL("app/", self.registration.scope).href;

self.addEventListener("install", () => {
  self.skipWaiting();
});

self.addEventListener("activate", (e) => {
  e.waitUntil(caches.keys().then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)))));
  self.clients.claim();
});

const offline = () =>
  new Response("<!doctype html><meta charset=utf-8><title>FlowLine</title><p style='font-family:sans-serif;padding:2rem'>لا يوجد اتصال. أعد المحاولة عند عودة الشبكة.</p>", {
    status: 503,
    headers: { "Content-Type": "text/html; charset=utf-8" },
  });

async function handle(req) {
  try {
    const res = await fetch(req);
    if (res && res.ok && res.type === "basic") {
      caches
        .open(CACHE)
        .then((c) => c.put(req, res.clone()))
        .catch(() => {});
    }
    return res;
  } catch {
    const hit = await caches.match(req);
    if (hit) return hit;
    if (req.mode === "navigate") return (await caches.match(SHELL)) || offline();
    return Response.error();
  }
}

self.addEventListener("fetch", (e) => {
  const req = e.request;
  if (req.method !== "GET") return;
  let url;
  try {
    url = new URL(req.url);
  } catch {
    return;
  }
  if (url.origin !== self.location.origin) return;
  e.respondWith(handle(req));
});
