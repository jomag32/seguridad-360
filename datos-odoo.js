// Acceso a Odoo (modelos x_seg360_*) con el usuario de servicio. ejecutar(modelo, método, args, kwargs) = execute_kw.
import { soloDigitos, normLegajo } from "./public/regla.js";
export const aOdoo = (d) => new Date(d).toISOString().slice(0, 19).replace("T", " "); // UTC
export const deOdoo = (s) => (s ? new Date(s.replace(" ", "T") + "Z").toISOString() : null);
// datetime-local del teléfono (hora Argentina, UTC-3) → UTC
export const localArg = (s) => new Date(/[zZ]|[+-]\d\d:?\d\d$/.test(s) ? s : (s.length === 16 ? s + ":00" : s) + "-03:00");
const TIPO = { "Liviano": "liviano", "Pesado": "pesado", "Máquina": "maquina", "Semirremolque": "semirremolque" };
const TIPO_INV = Object.fromEntries(Object.entries(TIPO).map(([a, b]) => [b, a]));
const COLOR = { ROJO: "rojo", AMARILLO: "amarillo", VERDE: "verde" };
const RESTR = { "No salir a ruta": "x_restr_ruta", "No superar 60 km/h": "x_restr_60", "Controlar agua y aceite": "x_restr_agua_aceite" };
const ESTADO = { habilitada: "Habilitada", bloqueada: "No apto – bloqueado", salida_autorizada: "Salida autorizada", liberada: "Liberada" };
const n = (v) => (Array.isArray(v) ? v[1] : "");
const id = (v) => (Array.isArray(v) ? v[0] : null);
const kitTexto = (k) => Object.entries(k || {}).map(([a, b]) => `${a}: ${b}`).join("\n");
const kitObj = (t) => Object.fromEntries(String(t || "").split("\n").filter(Boolean).map((l) => l.split(": ")));
const CH_F = ["x_name", "x_fecha_hora", "x_movimiento", "x_guardia_id", "x_vehiculo_id", "x_unidad_texto", "x_tipo", "x_porton_id", "x_km_horas", "x_frenos", "x_luces",
  "x_kit", "x_vtv_vigente", "x_documentacion", "x_dictamen", "x_motivos", "x_bloqueante", "x_estado", "x_aut_salida_por_id", "x_aut_salida_motivo", "x_aut_salida_fecha", "x_observaciones", "x_firma_verificada"];
const LL_F = ["x_name", "x_fecha_hora", "x_vehiculo_id", "x_unidad_texto", "x_color", "x_restr_ruta", "x_restr_60", "x_restr_agua_aceite", "x_restr_otra",
  "x_entrego", "x_guardia_id", "x_observaciones", "x_create_date", "create_date", "x_firma_verificada"];

export function crearDatos(ejecutar) {
  const sr = (m, dom, fields, kw = {}) => ejecutar(m, "search_read", [dom], { fields, ...kw });
  const mapCh = (r) => ({ id: r.id, numero: r.x_name, fecha: deOdoo(r.x_fecha_hora), movimiento: r.x_movimiento === "salida" ? "Salida a uso" : "Retorno de uso",
    guardia: n(r.x_guardia_id), unidad: n(r.x_vehiculo_id) || r.x_unidad_texto || "", vehiculoId: id(r.x_vehiculo_id), tipo: TIPO_INV[r.x_tipo] || r.x_tipo,
    acceso: n(r.x_porton_id), medida: r.x_km_horas, frenos: r.x_frenos === "ok" ? "OK" : "NO", luces: r.x_luces === "ok" ? "OK" : "NO", kit: kitObj(r.x_kit), vtv: { si: "Sí", no: "No", na: "No aplica" }[r.x_vtv_vigente] || "", documentacion: { si: "Sí", no: "No" }[r.x_documentacion] || "",
    dictamen: { resultado: r.x_dictamen === "apto" ? "APTO" : "NO APTO", bloqueante: !!r.x_bloqueante, motivos: r.x_motivos ? r.x_motivos.split(" | ") : [] },
    estado: r.x_estado, estadoTexto: ESTADO[r.x_estado] || r.x_estado, firmaVerificada: !!r.x_firma_verificada,
    autorizacion: r.x_estado === "salida_autorizada" ? { por: n(r.x_aut_salida_por_id), motivo: r.x_aut_salida_motivo || "", fecha: deOdoo(r.x_aut_salida_fecha) } : null,
    observaciones: r.x_observaciones || "" });
  const mapLl = (r) => ({ id: r.id, numero: r.x_name, fechaHora: deOdoo(r.x_fecha_hora), unidad: n(r.x_vehiculo_id) || r.x_unidad_texto || "", color: (r.x_color || "").toUpperCase(),
    restricciones: Object.entries(RESTR).filter(([, f]) => r[f]).map(([t]) => t), otra: r.x_restr_otra || "", entrego: r.x_entrego, guardia: n(r.x_guardia_id),
    observaciones: r.x_observaciones || "", registrado: deOdoo(r.create_date), firmaVerificada: !!r.x_firma_verificada });
  return {
    async catalogos() {
      const [g, p, u] = await Promise.all([
        sr("x_seg360_guardia", [["x_active", "=", true]], ["x_name", "x_empresa"], { order: "x_name" }),
        sr("x_seg360_porton", [["x_active", "=", true]], ["x_codigo", "x_name", "x_tipo"], { order: "x_codigo" }),
        sr("fleet.vehicle", [], ["license_plate", "display_name"], { order: "license_plate" })]);
      return { guardias: g.map((x) => ({ id: x.id, nombre: x.x_name, empresa: x.x_empresa })),
        portones: p.filter((x) => x.x_tipo !== "peatonal").map((x) => ({ id: x.id, codigo: x.x_codigo, nombre: x.x_name })),
        unidades: u.map((x) => ({ id: x.id, nombre: x.license_plate ? `${x.license_plate} · ${x.display_name}` : x.display_name })) };
    },
    /** Firma del guardia: legajo + DNI contra el maestro. Devuelve el guardia o null. */
    async firmar(guardiaId, legajo, dni) {
      const [g] = await ejecutar("x_seg360_guardia", "read", [[+guardiaId]], { fields: ["x_name", "x_legajo", "x_dni", "x_active"] });
      if (!g || !g.x_active) return null;
      return normLegajo(g.x_legajo) === normLegajo(legajo) && soloDigitos(g.x_dni) === soloDigitos(dni) && soloDigitos(dni) ? g : null;
    },
    async bloqueo(vehiculoId, unidad) {
      const dom = [["x_estado", "=", "bloqueada"], ...(vehiculoId ? [["x_vehiculo_id", "=", +vehiculoId]] : [["x_vehiculo_id", "=", false], ["x_unidad_texto", "=ilike", unidad]])];
      const r = await sr("x_seg360_chequeo", dom, ["x_name"], { limit: 1, order: "id desc" }); return r[0]?.x_name || null;
    },
    async crearChequeo(c, d, g, ahora = new Date()) {
      const nuevo = await ejecutar("x_seg360_chequeo", "create", [{ x_name: "/", x_fecha_hora: aOdoo(ahora), x_movimiento: c.movimiento === "Salida a uso" ? "salida" : "retorno",
        x_guardia_id: +c.guardiaId, x_vehiculo_id: c.vehiculoId ? +c.vehiculoId : false, x_unidad_texto: c.vehiculoId ? false : c.unidad.trim(), x_tipo: TIPO[c.tipo],
        x_porton_id: +c.portonId, x_km_horas: Number(c.medida), x_frenos: c.frenos === "OK" ? "ok" : "no", x_luces: c.luces === "OK" ? "ok" : "no", x_kit: kitTexto(c.kit), x_vtv_vigente: c.tipo === "Máquina" ? "na" : c.vtv === "Sí" ? "si" : "no", x_documentacion: c.documentacion === "Sí" ? "si" : "no",
        x_dictamen: d.resultado === "APTO" ? "apto" : "no_apto", x_motivos: d.motivos.join(" | "), x_bloqueante: !!d.bloqueante, x_observaciones: (c.observaciones || "").trim(),
        x_firma_legajo: g.x_legajo, x_firma_verificada: true, x_firma_fecha: aOdoo(ahora), x_clave_envio: c.claveEnvio || false }]);
      return this.chequeo(nuevo);
    },
    async chequeo(i) { const [r] = await ejecutar("x_seg360_chequeo", "read", [[+i]], { fields: CH_F }); return r ? mapCh(r) : null; },
    async chequeos(limit = 50) { return (await sr("x_seg360_chequeo", [], CH_F, { order: "id desc", ...(limit ? { limit } : {}) })).map(mapCh); },
    async crearLlave(l, g, ahora = new Date()) {
      const am = l.color === "AMARILLO", rs = am ? l.restricciones || [] : [];
      const v = { x_name: "/", x_fecha_hora: aOdoo(localArg(l.fechaHora)), x_vehiculo_id: l.vehiculoId ? +l.vehiculoId : false, x_unidad_texto: l.vehiculoId ? false : l.unidad.trim(),
        x_color: COLOR[l.color], x_restr_otra: am ? (l.otra || "").trim() : false, x_entrego: l.entrego.trim(), x_guardia_id: +l.guardiaId,
        x_observaciones: (l.observaciones || "").trim(), x_firma_legajo: g.x_legajo, x_firma_verificada: true, x_firma_fecha: aOdoo(ahora) };
      for (const [t, f] of Object.entries(RESTR)) v[f] = rs.includes(t);
      const nuevo = await ejecutar("x_seg360_llave", "create", [v]);
      const [r] = await ejecutar("x_seg360_llave", "read", [[nuevo]], { fields: LL_F.filter((f) => f !== "x_create_date") }); return mapLl(r);
    },
    async llaves(limit = 50) { return (await sr("x_seg360_llave", [], LL_F.filter((f) => f !== "x_create_date"), { order: "id desc", ...(limit ? { limit } : {}) })).map(mapLl); },
    async semana() {
      const [s] = await sr("x_seg360_semana", [], ["x_name", "x_inicio", "x_garita"], { order: "x_inicio desc", limit: 1 });
      if (!s) return null; return this._armar(s);
    },
    async semanas() { const ss = await sr("x_seg360_semana", [], ["x_name", "x_inicio", "x_garita"], { order: "x_inicio" }); return Promise.all(ss.map((s) => this._armar(s))); },
    async _armar(s) {
      const t = await sr("x_seg360_turno", [["x_semana_id", "=", s.id]], ["x_fecha", "x_turno", "x_guardia_id", "x_puesto"], { order: "x_fecha, x_turno, id" });
      const gids = [...new Set(t.map((x) => id(x.x_guardia_id)))];
      const emp = Object.fromEntries((gids.length ? await ejecutar("x_seg360_guardia", "read", [gids], { fields: ["x_empresa"] }) : []).map((g) => [g.id, g.x_empresa]));
      const dias = [...new Set(t.map((x) => x.x_fecha))].map((f) => ({ fecha: f, guardias: t.filter((x) => x.x_fecha === f).map((x) => ({ turno: x.x_turno === "dia" ? "Día" : "Noche",
        guardiaId: id(x.x_guardia_id), nombre: n(x.x_guardia_id), empresa: emp[id(x.x_guardia_id)] || "", puesto: x.x_puesto || "S06" })) }));
      return { id: s.id, numero: s.x_name, inicio: s.x_inicio, garita: s.x_garita, dias };
    },
    async grabarSemana(s) {
      const [ex] = await sr("x_seg360_semana", [["x_inicio", "=", s.inicio]], ["id"], { limit: 1 });
      const sid = ex ? ex.id : await ejecutar("x_seg360_semana", "create", [{ x_name: "/", x_inicio: s.inicio, x_garita: "S06" }]);
      const viejos = await ejecutar("x_seg360_turno", "search", [[["x_semana_id", "=", sid]]]);
      if (viejos.length) await ejecutar("x_seg360_turno", "unlink", [viejos]);
      await ejecutar("x_seg360_turno", "create", [s.dias.flatMap((d) => d.guardias.map((g) => ({ x_semana_id: sid, x_fecha: d.fecha,
        x_turno: g.turno === "Día" ? "dia" : "noche", x_guardia_id: +g.guardiaId, x_puesto: g.puesto || "S06" })))]);
      return sid;
    },
  };
}
