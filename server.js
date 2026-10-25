// seguridad-360 · Tecnología ARME · piloto Visión 360 (sin Odoo). Node 20, sin dependencias.
// Sirve public/ y guarda en un archivo JSON (DATA_DIR, por defecto ./datos).
import http from "node:http"; import fs from "node:fs"; import path from "node:path"; import { fileURLToPath } from "node:url"; import crypto from "node:crypto";
import { dictaminar, validarSemana, validarLlave, RESTRICCIONES, TIPOS } from "./public/regla.js";
const RAIZ = path.dirname(fileURLToPath(import.meta.url));
const DIR = process.env.DATA_DIR || path.join(RAIZ, "datos");
const ARCH = path.join(DIR, "registros.json");
fs.mkdirSync(DIR, { recursive: true });
const leer = () => { try { return JSON.parse(fs.readFileSync(ARCH, "utf8")); } catch { return { semanas: [], chequeos: [], llaves: [] }; } };
const grabar = (db) => { fs.writeFileSync(ARCH + ".tmp", JSON.stringify(db)); fs.renameSync(ARCH + ".tmp", ARCH); };
const TIPO = { ".html": "text/html; charset=utf-8", ".js": "text/javascript", ".css": "text/css", ".png": "image/png", ".svg": "image/svg+xml" };
const json = (r, c, o) => { r.writeHead(c, { "content-type": "application/json" }); r.end(JSON.stringify(o)); };
const cuerpo = (q) => new Promise((ok, mal) => { let b = ""; q.on("data", (d) => { b += d; if (b.length > 8e6) q.destroy(); }); q.on("end", () => { try { ok(JSON.parse(b || "{}")); } catch (e) { mal(e); } }); });
const csv = (filas) => "\ufeff" + filas.map((f) => f.map((v) => `"${String(v ?? "").replace(/"/g, '""')}"`).join(";")).join("\r\n");
// Clave de acceso simple (env ACCESS_KEY). Sin clave configurada la API queda cerrada.
const claveOk = (q) => { const k = process.env.ACCESS_KEY || "", d = String(q.headers["x-access-key"] || "").trim().toUpperCase();
  if (!k) return false; const a = crypto.createHash("sha256").update(k.toUpperCase()).digest(), b = crypto.createHash("sha256").update(d).digest();
  return crypto.timingSafeEqual(a, b); };
const semanaActual = (db) => db.semanas[db.semanas.length - 1] || null;

export const app = async (q, r) => {
  const u = new URL(q.url, "http://x");
  try {
    if (u.pathname === "/healthz") return json(r, 200, { ok: true });
    if (u.pathname.startsWith("/api/") && !claveOk(q)) return json(r, 401, { error: "clave requerida" });
    if (u.pathname === "/api/semana" && q.method === "GET") return json(r, 200, semanaActual(leer()));
    if (u.pathname === "/api/semana" && q.method === "POST") {
      const s = await cuerpo(q); const e = validarSemana(s);
      if (e.length) return json(r, 422, { errores: e });
      const db = leer(); db.semanas = db.semanas.filter((x) => x.inicio !== s.inicio);
      db.semanas.push({ ...s, creado: new Date().toISOString() }); db.semanas.sort((a, b) => a.inicio.localeCompare(b.inicio)); grabar(db);
      return json(r, 201, { ok: true });
    }
    if (u.pathname === "/api/chequeos" && q.method === "GET") return json(r, 200, leer().chequeos.slice(-50).reverse());
    if (u.pathname === "/api/chequeos" && q.method === "POST") {
      const c = await cuerpo(q);
      if (!c.guardia || !c.unidad?.trim() || !TIPOS.includes(c.tipo) || !c.acceso || !["Salida a uso", "Retorno de uso"].includes(c.movimiento))
        return json(r, 422, { errores: ["Faltan datos obligatorios"] });
      if (c.tipo === "Semirremolque") c.medida = 0;
      if (!(Number(c.medida) >= 0)) return json(r, 422, { errores: ["Km u horas inválido"] });
      delete c.foto; // el piloto no guarda fotos
      const d = dictaminar(c); // el dictamen lo recalcula SIEMPRE el servidor
      const db = leer(); const reg = { id: Math.max(0, ...db.chequeos.map((x) => x.id)) + 1, fecha: new Date().toISOString(), ...c, dictamen: d };
      db.chequeos.push(reg); grabar(db); return json(r, 201, reg);
    }
    if (u.pathname === "/api/llaves" && q.method === "GET") return json(r, 200, (leer().llaves || []).slice(-50).reverse());
    if (u.pathname === "/api/llaves" && q.method === "POST") {
      const b = await cuerpo(q); const e = validarLlave(b); if (e.length) return json(r, 422, { errores: e });
      const l = { unidad: b.unidad.trim(), color: b.color, restricciones: b.color === "AMARILLO" ? (b.restricciones || []).filter((x) => RESTRICCIONES.includes(x)) : [],
        otra: b.color === "AMARILLO" ? (b.otra || "").trim() : "", entrego: b.entrego.trim(), guardia: b.guardia.trim(), fechaHora: b.fechaHora, observaciones: (b.observaciones || "").trim() };
      const db = leer(); db.llaves ||= []; const reg = { id: Math.max(0, ...db.llaves.map((x) => x.id)) + 1, registrado: new Date().toISOString(), ...l };
      db.llaves.push(reg); grabar(db); return json(r, 201, reg);
    }
    const ml = u.pathname.match(/^\/api\/llaves\/(\d+)$/);
    if (ml && q.method === "DELETE") { const db = leer(); db.llaves ||= []; const n = db.llaves.length; db.llaves = db.llaves.filter((c) => c.id !== +ml[1]); grabar(db); return json(r, n === db.llaves.length ? 404 : 200, { ok: true }); }
    if (u.pathname === "/api/export/llaves.csv") {
      const f = [["id", "fecha_hora", "unidad", "color", "restricciones", "otra", "entrego", "guardia_recibe", "observaciones", "registrado"]];
      (leer().llaves || []).forEach((l) => f.push([l.id, l.fechaHora, l.unidad, l.color, l.restricciones.join(" | "), l.otra, l.entrego, l.guardia, l.observaciones, l.registrado]));
      r.writeHead(200, { "content-type": "text/csv; charset=utf-8", "content-disposition": "attachment; filename=llaves.csv" }); return r.end(csv(f));
    }
    let m = u.pathname.match(/^\/api\/chequeos\/(\d+)$/);
    if (m && q.method === "DELETE") { const db = leer(), n = db.chequeos.length; db.chequeos = db.chequeos.filter((c) => c.id !== +m[1]); grabar(db); return json(r, n === db.chequeos.length ? 404 : 200, { ok: true }); }
    if (u.pathname === "/api/semana" && q.method === "DELETE") { const db = leer(), n = db.semanas.length; db.semanas = db.semanas.filter((x) => x.inicio !== u.searchParams.get("inicio")); grabar(db); return json(r, n === db.semanas.length ? 404 : 200, { ok: true }); }
    if (u.pathname === "/api/export/chequeos.csv") {
      const f = [["id", "fecha", "movimiento", "guardia", "unidad", "tipo", "acceso", "km_horas", "frenos", "luces", "kit", "resultado", "motivos", "autoriza", "motivo_aut", "observaciones"]];
      leer().chequeos.forEach((c) => f.push([c.id, c.fecha, c.movimiento, c.guardia, c.unidad, c.tipo, c.acceso, c.medida, c.frenos, c.luces,
        Object.entries(c.kit || {}).map(([k, v]) => `${k}:${v}`).join(" | "), c.dictamen.resultado, c.dictamen.motivos.join(" | "),
        c.autorizacion?.nombre, c.autorizacion?.motivo, c.observaciones]));
      r.writeHead(200, { "content-type": "text/csv; charset=utf-8", "content-disposition": "attachment; filename=chequeos.csv" }); return r.end(csv(f));
    }
    if (u.pathname === "/api/export/guardias.csv") {
      const f = [["semana", "fecha", "turno", "nombre", "empresa", "puesto"]];
      leer().semanas.forEach((s) => s.dias.forEach((d) => d.guardias.forEach((g) => f.push([s.inicio, d.fecha, g.turno, g.nombre, g.empresa, g.puesto]))));
      r.writeHead(200, { "content-type": "text/csv; charset=utf-8", "content-disposition": "attachment; filename=guardias.csv" }); return r.end(csv(f));
    }
    let p = u.pathname === "/" ? "/index.html" : u.pathname;
    const f = path.join(RAIZ, "public", path.normalize(p).replace(/^(\.\.[/\\])+/, ""));
    if (!f.startsWith(path.join(RAIZ, "public"))) return json(r, 403, {});
    fs.readFile(f, (e, b) => { if (e) return json(r, 404, { error: "no encontrado" }); r.writeHead(200, { "content-type": TIPO[path.extname(f)] || "application/octet-stream", "cache-control": "no-cache" }); r.end(b); });
  } catch (e) { json(r, 400, { error: "pedido inválido" }); }
};
if (process.argv[1] === fileURLToPath(import.meta.url))
  http.createServer(app).listen(+process.env.PORT || 8360, () => console.log("seguridad-360 en http://localhost:" + (process.env.PORT || 8360)));
