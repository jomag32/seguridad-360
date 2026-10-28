// Service worker de Seguridad 360 (mismo enfoque que hys-carga): guarda solo la «cáscara»
// (HTML, JS, CSS, íconos) para que la app abra rápido e instalable; red primero, así un deploy nuevo llega solo.
// · NUNCA intercepta /api/ (datos de Odoo, CSV) ni pedidos que no sean GET ni otros orígenes:
//   las respuestas de la API y la clave de acceso (header x-access-key / localStorage) jamás pasan por la caché.
// · VERSION: subirla en cada deploy que cambie la cáscara.
const VERSION = "2026-10-28.1";
const CACHE = `seg360-cascara-${VERSION}`;
const RED_MS = 4000;
const CASCARA = ["/", "/index.html", "/app.js", "/regla.js", "/estilo.css", "/manifest.webmanifest",
  "/iconos/icono-192.png", "/iconos/icono-512.png", "/iconos/icono-maskable-192.png", "/iconos/icono-maskable-512.png",
  "/iconos/apple-touch-icon.png", "/iconos/favicon-32.png"];

self.addEventListener("install", (ev) => {
  ev.waitUntil((async () => {
    const c = await caches.open(CACHE);
    await Promise.all(CASCARA.map(async (u) => {
      try { const r = await fetch(new Request(u, { cache: "reload" })); if (r.ok) await c.put(u, r); } catch (e) { /* se guarda al usarse */ }
    }));
    await self.skipWaiting();
  })());
});

self.addEventListener("activate", (ev) => {
  ev.waitUntil((async () => {
    for (const k of await caches.keys()) if (k.startsWith("seg360-") && k !== CACHE) await caches.delete(k);
    await self.clients.claim();
  })());
});

self.addEventListener("fetch", (ev) => {
  const req = ev.request;
  if (req.method !== "GET") return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;
  if (url.pathname.startsWith("/api/")) return;              // API y CSV: siempre red, nunca copia
  if (req.headers.has("x-access-key")) return;               // nada que lleve la clave
  if (url.pathname === "/sw.js") return;
  ev.respondWith(redPrimero(req, url));
});

async function redPrimero(req, url) {
  const c = await caches.open(CACHE);
  const nav = req.mode === "navigate" && (url.pathname === "/" || url.pathname === "/index.html");
  const clave = nav ? "/index.html" : url.pathname;
  if (!nav && (req.mode === "navigate" || !CASCARA.includes(clave))) return fetch(req); // solo la cáscara conocida
  const red = fetch(nav ? "/index.html" : req, { cache: "no-cache" }).then(async (r) => {
    if (r.ok && r.type === "basic") await c.put(clave, r.clone());
    return r;
  });
  const copia = await c.match(clave);
  if (!copia) return red;
  const tarde = new Promise((ok) => setTimeout(() => ok(null), RED_MS));
  try { const r = await Promise.race([red, tarde]); if (r && r.ok) return r; } catch (e) { /* sin señal */ }
  red.catch(() => {});
  return copia;
}
