// Seguridad 360 · Tecnología ARME · app de garita para guardias de terceros. Node 20, sin dependencias.
// Todo se guarda en Odoo (modelos x_seg360_*) con el usuario de servicio; la app es solo el frente para el teléfono.
// Env: ACCESS_KEY, ODOO_URL, ODOO_DB, ODOO_USER, ODOO_PASSWORD (nunca van al código ni a los logs).
import http from "node:http"; import fs from "node:fs"; import path from "node:path"; import { fileURLToPath } from "node:url"; import crypto from "node:crypto";
import { dictaminar, validarSemana, validarLlave, validarChequeo, validarIngreso, validarValidacion, validarFotos, UBICACIONES, RESTRICCIONES, validarFotosChequeo, fotosChequeo } from "./public/regla.js";
import { crearCliente, ErrorOdoo } from "./odoo.js"; import { crearDatos } from "./datos-odoo.js";
const RAIZ = path.dirname(fileURLToPath(import.meta.url));
const TIPO = { ".html": "text/html; charset=utf-8", ".js": "text/javascript", ".css": "text/css", ".png": "image/png", ".svg": "image/svg+xml", ".webmanifest": "application/manifest+json", ".ico": "image/x-icon" };
const json = (r, c, o) => { r.writeHead(c, { "content-type": "application/json" }); r.end(JSON.stringify(o)); };
const cuerpo = (q, max = 1e6) => new Promise((ok, mal) => { let b = ""; q.on("data", (d) => { b += d; if (b.length > max) q.destroy(); }); q.on("end", () => { try { ok(JSON.parse(b || "{}")); } catch (e) { mal(e); } }); });
const csv = (filas) => "\ufeff" + filas.map((f) => f.map((v) => `"${String(v ?? "").replace(/"/g, '""')}"`).join(";")).join("\r\n");
const claveOk = (q) => { const k = process.env.ACCESS_KEY || "", d = String(q.headers["x-access-key"] || "").trim().toUpperCase();
  if (!k) return false; const a = crypto.createHash("sha256").update(k.toUpperCase()).digest(), b = crypto.createHash("sha256").update(d).digest();
  return crypto.timingSafeEqual(a, b); };
const enviarCsv = (r, nombre, f) => { r.writeHead(200, { "content-type": "text/csv; charset=utf-8", "content-disposition": `attachment; filename=seguridad-360-${nombre}.csv` }); r.end(csv(f)); };

export function crearApp(datos) {
  return async (q, r) => {
    const u = new URL(q.url, "http://x");
    try {
      if (u.pathname === "/healthz") return json(r, 200, { ok: true });
      if (u.pathname.startsWith("/api/") && !claveOk(q)) return json(r, 401, { error: "Clave de acceso incorrecta" });
      if (u.pathname.startsWith("/api/") && !datos) return json(r, 503, { errores: ["La app no está conectada a Odoo (faltan variables)"] });
      if (u.pathname === "/api/catalogos") return json(r, 200, { ...(await datos.catalogos()), plazos: await datos.plazos() });
      // Etapa 1 · Ingreso a mantenimiento (maintenance.request) y validación de Logística
      if (u.pathname === "/api/ultima-medida") return json(r, 200, { medida: await datos.ultimaMedida(u.searchParams.get("vehiculoId"), u.searchParams.get("unidad")) });
      if (u.pathname === "/api/ingresos/fotos-pendientes") return json(r, 200, await datos.fotosPendientes());
      const mf = u.pathname.match(/^\/api\/ingresos\/(\d+)\/fotos$/);
      if (mf && q.method === "POST") {
        const f = await cuerpo(q, 12e6); const ing = await datos.ingreso(mf[1]); if (!ing) return json(r, 404, { error: "no encontrado" });
        const e = validarFotos(f, ing.causa); if (e.length) return json(r, 422, { errores: e });
        const g = await datos.firmar(f.guardiaId, f.legajo, f.dni); if (!g) return json(r, 422, { errores: ["Firma: el legajo o el DNI no coinciden con el guardia elegido"] });
        return json(r, 200, await datos.completarFotos(mf[1], f.fotos, g));
      }
      const mu = u.pathname.match(/^\/api\/ingresos\/(\d+)\/ubicacion$/);
      if (mu && q.method === "POST") { const b = await cuerpo(q); if (!UBICACIONES.includes(b.ubicacion)) return json(r, 422, { errores: ["Elegí la ubicación"] }); return json(r, 200, await datos.cambiarUbicacion(mu[1], b.ubicacion)); }
      if (u.pathname === "/api/ingresos" && q.method === "GET") return json(r, 200, await datos.ingresos(u.searchParams.get("todos") !== "1"));
      if (u.pathname === "/api/ingresos" && q.method === "POST") {
        const i = await cuerpo(q, 12e6); const e = validarIngreso(i, await datos.ultimaMedida(i.vehiculoId, i.unidad)); if (e.length) return json(r, 422, { errores: e });
        const g = await datos.firmar(i.guardiaId, i.legajo, i.dni);
        if (!g) return json(r, 422, { errores: ["Firma: el legajo o el DNI no coinciden con el guardia elegido"] });
        const ab = await datos.ingresoAbierto(i.vehiculoId, i.unidad);
        if (ab) return json(r, 409, { errores: [`La unidad ya tiene un ingreso abierto: pedido #${ab.id} «${ab.numero}» (${ab.causa}, ${ab.etapa || "en curso"}). No se crea otro; si hace falta, que Logística lo valide o rechace.`], existente: ab.id });
        return json(r, 201, await datos.crearIngreso(i, g));
      }
      const mv = u.pathname.match(/^\/api\/ingresos\/(\d+)\/validacion$/);
      if (mv && q.method === "POST") {
        const v = await cuerpo(q); const e = validarValidacion(v); if (e.length) return json(r, 422, { errores: e });
        try { const x = await datos.validar(mv[1], v); return x ? json(r, 200, x) : json(r, 404, { error: "no encontrado" }); }
        catch (er) { if (er.yaValidado) return json(r, 409, { errores: ["Este ingreso ya fue validado o rechazado"] }); throw er; }
      }
      if (u.pathname === "/api/semana" && q.method === "GET") return json(r, 200, await datos.semana());
      if (u.pathname === "/api/semana" && q.method === "POST") {
        const s = await cuerpo(q); const e = validarSemana(s); if (e.length) return json(r, 422, { errores: e });
        await datos.grabarSemana(s); return json(r, 201, { ok: true });
      }
      if (u.pathname === "/api/chequeos" && q.method === "GET") return json(r, 200, await datos.chequeos());
      const mc = u.pathname.match(/^\/api\/chequeos\/(\d+)$/);
      if (mc && q.method === "GET") { const c = await datos.chequeo(mc[1]); return c ? json(r, 200, c) : json(r, 404, { error: "no encontrado" }); }
      if (u.pathname === "/api/chequeos" && q.method === "POST") {
        const c = await cuerpo(q, 12e6); if (c.tipo === "Semirremolque") c.medida = 0;
        const e = validarChequeo(c); if (e.length) return json(r, 422, { errores: e });
        delete c.foto; delete c.autorizacion; // la excepción la autoriza solo el Jefe de Logística en Odoo
        const g = await datos.firmar(c.guardiaId, c.legajo, c.dni);
        if (!g) return json(r, 422, { errores: ["Firma: el legajo o el DNI no coinciden con el guardia elegido"] });
        if (c.movimiento !== "Salida a uso") c.estadoLogistica = "Apto";
        const d = dictaminar(c); // el dictamen lo recalcula SIEMPRE el servidor
        const ef = validarFotosChequeo(c, d); if (ef.length) return json(r, 422, { errores: ef });
        c.fotos = fotosChequeo(c);
        return json(r, 201, await datos.crearChequeo(c, d, g));
      }
      if (u.pathname === "/api/llaves" && q.method === "GET") return json(r, 200, await datos.llaves());
      if (u.pathname === "/api/llaves" && q.method === "POST") {
        const b = await cuerpo(q); const e = validarLlave(b); if (e.length) return json(r, 422, { errores: e });
        b.restricciones = (b.restricciones || []).filter((x) => RESTRICCIONES.includes(x));
        const g = await datos.firmar(b.guardiaId, b.legajo, b.dni);
        if (!g) return json(r, 422, { errores: ["Firma: el legajo o el DNI no coinciden con el guardia elegido"] });
        return json(r, 201, await datos.crearLlave(b, g));
      }
      if (u.pathname === "/api/export/chequeos.csv") {
        const f = [["numero", "fecha", "movimiento", "guardia", "unidad", "tipo", "porton", "km_horas", "frenos", "luces", "emite_humo", "fotos", "vtv_rto", "documentacion", "liq_frenos", "refrigerante", "aceite_motor", "kit", "resultado", "motivos", "estado", "autorizo", "motivo_autorizacion", "observaciones", "gravedad_obs", "observacion_falla", "ingreso_previsto", "logistica_obs", "ingreso_mantenimiento"]];
        (await datos.chequeos(0)).forEach((c) => f.push([c.numero, c.fecha, c.movimiento, c.guardia, c.unidad, c.tipo, c.acceso, c.medida, c.frenos, c.luces, c.humo, c.fotos, c.vtv, c.documentacion, c.fluidos?.frenos, c.fluidos?.refrigerante, c.fluidos?.aceite,
          Object.entries(c.kit).map(([k, v]) => `${k}:${v}`).join(" | "), c.dictamen.resultado, c.dictamen.motivos.join(" | "), c.estadoTexto, c.autorizacion?.por, c.autorizacion?.motivo, c.observaciones, c.conObservacion?.gravedad, c.conObservacion?.observacion, c.conObservacion?.ingresoPrevisto, c.conObservacion?.logistica, c.ingresoId]));
        return enviarCsv(r, "chequeos", f);
      }
      if (u.pathname === "/api/export/ingresos.csv") {
        const f = [["numero", "unidad", "equipo", "causa", "sistema", "relato", "declaro", "llegada", "guardia_ok", "fecha_ok", "km_horas", "gravedad", "etapa", "validacion", "valido_por", "fecha_validacion", "ingreso_taller", "ubicacion", "motivo_rechazo", "fotos_pendientes"]];
        (await datos.ingresos(false)).forEach((x) => f.push([x.numero, x.unidad, x.equipo, x.causa, x.sistema, x.relato, x.declaro, x.llegada, x.guardia, x.okGuardia, x.medida, x.gravedad, x.etapa, x.validacion, x.validoPor, x.validacionFecha, x.ingresoFecha, x.ubicacion, x.motivoRechazo, x.fotosPendientes ? "sí" : "no"]));
        return enviarCsv(r, "ingresos", f);
      }
      if (u.pathname === "/api/export/llaves.csv") {
        const f = [["numero", "fecha_hora", "unidad", "color", "restricciones", "otra", "entrego", "guardia_recibe", "observaciones", "registrado"]];
        (await datos.llaves(0)).forEach((l) => f.push([l.numero, l.fechaHora, l.unidad, l.color, l.restricciones.join(" | "), l.otra, l.entrego, l.guardia, l.observaciones, l.registrado]));
        return enviarCsv(r, "llaves", f);
      }
      if (u.pathname === "/api/export/guardias.csv") {
        const f = [["semana", "fecha", "turno", "nombre", "empresa", "puesto"]];
        (await datos.semanas()).forEach((s) => s.dias.forEach((d) => d.guardias.forEach((g) => f.push([s.inicio, d.fecha, g.turno, g.nombre, g.empresa, g.puesto]))));
        return enviarCsv(r, "guardias", f);
      }
      if (u.pathname.startsWith("/api/")) return json(r, 404, { error: "no encontrado" });
      const p = u.pathname === "/" ? "/index.html" : u.pathname;
      const f = path.join(RAIZ, "public", path.normalize(p).replace(/^(\.\.[/\\])+/, ""));
      if (!f.startsWith(path.join(RAIZ, "public"))) return json(r, 403, {});
      fs.readFile(f, (e, b) => { if (e) return json(r, 404, { error: "no encontrado" }); r.writeHead(200, { "content-type": TIPO[path.extname(f)] || "application/octet-stream", "cache-control": "no-cache" }); r.end(b); });
    } catch (e) {
      if (e instanceof ErrorOdoo) {
        if (e.deDatos) return json(r, 409, { errores: [String(e.detalle || e.message).split("\n")[0]] }); // p. ej. unidad bloqueada (regla en Odoo)
        console.error("odoo:", e.message); return json(r, 502, { errores: ["No se pudo hablar con Odoo. Probá de nuevo en un minuto."] });
      }
      json(r, 400, { errores: ["Pedido inválido"] });
    }
  };
}
const env = process.env;
const datos = env.ODOO_URL && env.ODOO_DB && env.ODOO_USER && env.ODOO_PASSWORD ? crearDatos(crearCliente({ url: env.ODOO_URL, db: env.ODOO_DB, usuario: env.ODOO_USER, clave: env.ODOO_PASSWORD }).ejecutar) : null;
export const app = crearApp(datos);
if (process.argv[1] === fileURLToPath(import.meta.url))
  http.createServer(app).listen(+env.PORT || 8360, () => console.log("Seguridad 360 en http://localhost:" + (env.PORT || 8360) + (datos ? " · Odoo" : " · SIN Odoo")));
