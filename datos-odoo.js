// Acceso a Odoo (modelos x_seg360_*) con el usuario de servicio. ejecutar(modelo, método, args, kwargs) = execute_kw.
import { soloDigitos, normLegajo, PLAZOS_H, PRIORIDADES } from "./public/regla.js";
export const aOdoo = (d) => new Date(d).toISOString().slice(0, 19).replace("T", " "); // UTC
export const deOdoo = (s) => (s ? new Date(s.replace(" ", "T") + "Z").toISOString() : null);
// datetime-local del teléfono (hora Argentina, UTC-3) → UTC
export const localArg = (s) => new Date(/[zZ]|[+-]\d\d:?\d\d$/.test(s) ? s : (s.length === 16 ? s + ":00" : s) + "-03:00");
const TIPO = { "Liviano": "liviano", "Pesado": "pesado", "Máquina": "maquina", "Semirremolque": "semirremolque" };
const TIPO_INV = Object.fromEntries(Object.entries(TIPO).map(([a, b]) => [b, a]));
const COLOR = { ROJO: "rojo", AMARILLO: "amarillo", VERDE: "verde" };
const RESTR = { "No salir a ruta": "x_restr_ruta", "No superar 60 km/h": "x_restr_60", "Controlar agua y aceite": "x_restr_agua_aceite" };
const ESTADO = { habilitada: "Habilitada", bloqueada: "No apto – bloqueado", salida_autorizada: "Salida autorizada", liberada: "Liberada" };
// Nivel de fluidos (solo salida). Campos selección en Odoo: ver scripts/odoo-seg360-fluidos.py
const NIVEL = { "Bajo el mínimo": "bajo", "Mínimo": "minimo", "Medio": "medio", "Máximo": "maximo" };
const NIVEL_INV = Object.fromEntries(Object.entries(NIVEL).map(([a, b]) => [b, a]));
const FL = { frenos: "x_nivel_liq_frenos", refrigerante: "x_nivel_refrigerante", aceite: "x_nivel_aceite" };
// Etapa 1 (ver scripts/odoo-seg360-etapa1.py)
const DICT = { "APTO": "apto", "APTO CON OBSERVACIÓN": "apto_obs", "NO APTO": "no_apto" }; const DICT_INV = Object.fromEntries(Object.entries(DICT).map(([a, b]) => [b, a]));
const GRAV = { Alta: "alta", Media: "media", Baja: "baja" }; const GRAV_INV = Object.fromEntries(Object.entries(GRAV).map(([a, b]) => [b, a]));
export const SEL = (l) => Object.fromEntries(l.map((t) => [t, t.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_|_$/g, "").slice(0, 30)]));
import { CAUSAS, SISTEMAS, LLEGADAS, UBICACIONES, fotosExigidas } from "./public/regla.js";
const CAUSA = SEL(CAUSAS), SIST = SEL(SISTEMAS), LLEG = SEL(LLEGADAS), UBIC = SEL(UBICACIONES);
const inv = (o) => Object.fromEntries(Object.entries(o).map(([a, b]) => [b, a]));
const ETAPA_PENDIENTE = "Ingreso a validar (Logística)", ETAPA_INGRESA = "A iniciar";
const MR_F = ["name", "equipment_id", "x_vehiculo_id", "x_unidad_texto", "x_causa", "x_sistema", "description", "x_llegada", "x_guardia_id", "x_ok_guardia_fecha", "x_km_horas_llegada",
  "priority", "stage_id", "x_validacion", "x_declaro", "x_valido_por", "x_validacion_fecha", "x_ingreso_fecha", "x_rechazo_motivo", "x_chequeo_id", "request_date", "x_ubicacion", "x_fotos_pendientes"];
const n = (v) => (Array.isArray(v) ? v[1] : "");
const id = (v) => (Array.isArray(v) ? v[0] : null);
const kitTexto = (k) => Object.entries(k || {}).map(([a, b]) => `${a}: ${b}`).join("\n");
const kitObj = (t) => Object.fromEntries(String(t || "").split("\n").filter(Boolean).map((l) => l.split(": ")));
const CH_F = ["x_name", "x_fecha_hora", "x_movimiento", "x_guardia_id", "x_vehiculo_id", "x_unidad_texto", "x_tipo", "x_porton_id", "x_km_horas", "x_frenos", "x_luces",
  "x_kit", "x_vtv_vigente", "x_documentacion", "x_dictamen", "x_motivos", "x_bloqueante", "x_estado", "x_aut_salida_por_id", "x_aut_salida_motivo", "x_aut_salida_fecha", "x_observaciones", "x_firma_verificada", ...Object.values(FL), "x_gravedad", "x_obs_falla", "x_ingreso_previsto", "x_obs_logistica", "x_ingreso_id"];
const LL_F = ["x_name", "x_fecha_hora", "x_vehiculo_id", "x_unidad_texto", "x_color", "x_restr_ruta", "x_restr_60", "x_restr_agua_aceite", "x_restr_otra",
  "x_entrego", "x_guardia_id", "x_observaciones", "x_create_date", "create_date", "x_firma_verificada"];

const sistemaDe = (m) => { const t = m.join(" "); return /Frenos|frenos/.test(t) ? "Frenos" : /Luces/.test(t) ? "Luces / eléctrico" : /VTV|Documentaci/.test(t) ? "Documentación" : /Refrigerante/.test(t) ? "Refrigeración" : /Aceite/.test(t) ? "Motor" : /Falta/.test(t) ? "Kit obligatorio" : "Otro"; };
const mapMr = (r) => ({ id: r.id, numero: r.name, equipo: n(r.equipment_id), unidad: n(r.x_vehiculo_id) || r.x_unidad_texto || "", vehiculoId: id(r.x_vehiculo_id),
  causa: inv(CAUSA)[r.x_causa] || r.x_causa, sistema: inv(SIST)[r.x_sistema] || r.x_sistema, relato: r.description || "", llegada: inv(LLEG)[r.x_llegada] || r.x_llegada,
  guardia: n(r.x_guardia_id), okGuardia: deOdoo(r.x_ok_guardia_fecha), medida: r.x_km_horas_llegada, prioridad: r.priority, gravedad: (PRIORIDADES.find(([, v]) => v === r.priority) || [""])[0],
  etapa: n(r.stage_id), validacion: r.x_validacion, declaro: r.x_declaro || "", validoPor: r.x_valido_por || "", validacionFecha: deOdoo(r.x_validacion_fecha),
  ingresoFecha: deOdoo(r.x_ingreso_fecha), motivoRechazo: r.x_rechazo_motivo || "", chequeoId: id(r.x_chequeo_id), ubicacion: inv(UBIC)[r.x_ubicacion] || "", fotosPendientes: !!r.x_fotos_pendientes });
export function crearDatos(ejecutar) {
  const sr = (m, dom, fields, kw = {}) => ejecutar(m, "search_read", [dom], { fields, ...kw });
  const mapCh = (r) => ({ id: r.id, numero: r.x_name, fecha: deOdoo(r.x_fecha_hora), movimiento: r.x_movimiento === "salida" ? "Salida a uso" : "Retorno de uso",
    guardia: n(r.x_guardia_id), unidad: n(r.x_vehiculo_id) || r.x_unidad_texto || "", vehiculoId: id(r.x_vehiculo_id), tipo: TIPO_INV[r.x_tipo] || r.x_tipo,
    acceso: n(r.x_porton_id), medida: r.x_km_horas, frenos: r.x_frenos === "ok" ? "OK" : "NO", luces: r.x_luces === "ok" ? "OK" : "NO", kit: kitObj(r.x_kit), vtv: { si: "Sí", no: "No", na: "No aplica" }[r.x_vtv_vigente] || "", documentacion: { si: "Sí", no: "No" }[r.x_documentacion] || "",
    dictamen: { resultado: DICT_INV[r.x_dictamen] || "NO APTO", bloqueante: !!r.x_bloqueante, motivos: r.x_motivos ? r.x_motivos.split(" | ") : [] },
    estado: r.x_estado, estadoTexto: ESTADO[r.x_estado] || r.x_estado, firmaVerificada: !!r.x_firma_verificada,
    autorizacion: r.x_estado === "salida_autorizada" ? { por: n(r.x_aut_salida_por_id), motivo: r.x_aut_salida_motivo || "", fecha: deOdoo(r.x_aut_salida_fecha) } : null,
    fluidos: Object.fromEntries(Object.entries(FL).filter(([, f]) => r[f]).map(([k, f]) => [k, NIVEL_INV[r[f]] || r[f]])),
    observaciones: r.x_observaciones || "", ingresoId: id(r.x_ingreso_id),
    conObservacion: r.x_dictamen === "apto_obs" ? { gravedad: GRAV_INV[r.x_gravedad] || "", observacion: r.x_obs_falla || "", ingresoPrevisto: r.x_ingreso_previsto || "", logistica: r.x_obs_logistica || "" } : null });
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
        x_dictamen: DICT[d.resultado] || "no_apto", x_motivos: d.motivos.join(" | "), x_bloqueante: !!d.bloqueante, x_observaciones: (c.observaciones || "").trim(),
        x_firma_legajo: g.x_legajo, x_firma_verificada: true, x_firma_fecha: aOdoo(ahora), x_clave_envio: c.claveEnvio || false,
        ...Object.fromEntries(Object.entries(FL).map(([k, f]) => [f, c.movimiento === "Salida a uso" ? NIVEL[(c.fluidos || {})[k]] || false : false])),
        ...(d.resultado === "APTO CON OBSERVACIÓN" ? { x_gravedad: GRAV[c.gravedad], x_obs_falla: c.observacionFalla.trim(), x_ingreso_previsto: c.ingresoPrevisto, x_obs_logistica: c.logistica.trim() } : {}) }]);
      // NO APTO en portón → pasa directo a Ingreso a mantenimiento (causa declarada «No apto en portón»), sin ingreso previsto.
      if (d.resultado === "NO APTO") {
        const ing = await this.crearIngreso({ vehiculoId: c.vehiculoId, unidad: c.unidad, causa: "No apto en portón", sistema: sistemaDe(d.motivos), relato: d.motivos.join(" · "),
          declaro: "Guardia (chequeo en portón)", llegada: "Por sus medios", guardiaId: c.guardiaId, medida: c.medida, prioridad: d.bloqueante ? "3" : "1", fotos: {} }, g, ahora, nuevo);
        await ejecutar("x_seg360_chequeo", "write", [[nuevo], { x_ingreso_id: ing.id }]);
      }
      return this.chequeo(nuevo);
    },
    /** Plazos editables: parámetros del sistema seg360.plazo.<gravedad>.<tipo> (horas); si no se pueden leer, valores iniciales del documento. */
    async plazos() {
      const p = JSON.parse(JSON.stringify(PLAZOS_H));
      const r = await sr("ir.config_parameter", [["key", "=like", "seg360.plazo.%"]], ["key", "value"]).catch(() => []);
      for (const x of r) { const [, , g, ti] = x.key.split("."), gr = GRAV_INV[g], t = TIPO_INV[ti], h = parseInt(x.value, 10); if (gr && t && h > 0) { p[gr] = p[gr] || {}; p[gr][t] = h; } }
      return p;
    },
    async ultimaMedida(vehiculoId, unidad) {
      const dv = vehiculoId ? [["x_vehiculo_id", "=", +vehiculoId]] : [["x_vehiculo_id", "=", false], ["x_unidad_texto", "=ilike", unidad || ""]];
      const [a, b] = await Promise.all([sr("x_seg360_chequeo", dv, ["x_km_horas"], { order: "id desc", limit: 1 }), sr("maintenance.request", dv, ["x_km_horas_llegada"], { order: "id desc", limit: 1 })]);
      const v = [a[0]?.x_km_horas, b[0]?.x_km_horas_llegada].filter((x) => typeof x === "number"); return v.length ? Math.max(...v) : null;
    },
    async crearIngreso(i, g, ahora = new Date(), chequeoId = false) {
      const [eq] = i.vehiculoId ? await sr("maintenance.equipment", [["x_vehiculo_id", "=", +i.vehiculoId]], ["id"], { limit: 1 }) : [];
      const [st] = await sr("maintenance.stage", [["name", "=", ETAPA_PENDIENTE]], ["id"], { limit: 1 });
      const nuevo = await ejecutar("maintenance.request", "create", [{ name: `Ingreso · ${i.causa}`, equipment_id: eq?.id || false, x_vehiculo_id: i.vehiculoId ? +i.vehiculoId : false,
        x_unidad_texto: i.vehiculoId ? false : (i.unidad || "").trim(), maintenance_type: i.causa === "Service por km u horas" ? "preventive" : "corrective",
        x_causa: CAUSA[i.causa], x_sistema: SIST[i.sistema], description: i.relato.trim(), x_declaro: i.declaro.trim(), x_llegada: LLEG[i.llegada], x_guardia_id: +i.guardiaId,
        x_ok_guardia_fecha: aOdoo(ahora), x_km_horas_llegada: Number(i.medida), priority: i.prioridad, x_validacion: "pendiente", x_chequeo_id: chequeoId,
        x_firma_legajo: g.x_legajo, x_firma_verificada: true, ...(st ? { stage_id: st.id } : {}),
        x_fotos_pendientes: fotosExigidas(i.causa).some((k) => !(i.fotos || {})[k]) }]);
      await this._fotos(nuevo, i.fotos);
      return this.ingreso(nuevo);
    },
    async _fotos(rid, fotos) {
      for (const [k, d] of Object.entries(fotos || {})) {
        const m = /^data:(image\/[a-z]+);base64,(.+)$/.exec(d || ""); if (!m) continue;
        await ejecutar("ir.attachment", "create", [{ name: `${k}.${m[1].split("/")[1]}`, mimetype: m[1], datas: m[2], res_model: "maintenance.request", res_id: rid }]);
      }
    },
    async fotosPendientes() { return (await sr("maintenance.request", [["x_fotos_pendientes", "=", true]], MR_F, { order: "id desc", limit: 50 })).map(mapMr); },
    async completarFotos(i, fotos, g) {
      await this._fotos(+i, fotos);
      await ejecutar("maintenance.request", "write", [[+i], { x_fotos_pendientes: false, x_firma_legajo: g.x_legajo }]); return this.ingreso(i);
    },
    async cambiarUbicacion(i, u) { await ejecutar("maintenance.request", "write", [[+i], { x_ubicacion: UBIC[u] }]); return this.ingreso(i); },
    async ingreso(i) { const [r] = await ejecutar("maintenance.request", "read", [[+i]], { fields: MR_F }); return r ? mapMr(r) : null; },
    async ingresos(pendientes = true) { return (await sr("maintenance.request", pendientes ? [["x_validacion", "=", "pendiente"]] : [["x_validacion", "!=", false]], MR_F, { order: "id desc", limit: 50 })).map(mapMr); },
    /** Logística: valida → ingresa (corre el reloj: x_ingreso_fecha) · no valida → vuelve a Playa disponible (queda registrado quién declaró y el motivo). */
    async validar(i, v, ahora = new Date()) {
      const [r] = await ejecutar("maintenance.request", "read", [[+i]], { fields: ["x_validacion"] });
      if (!r) return null; if (r.x_validacion !== "pendiente") throw Object.assign(new Error("ya validado"), { yaValidado: true });
      const base = { x_valido_por: v.por.trim(), x_validacion_fecha: aOdoo(ahora) };
      if (v.valida) { const [st] = await sr("maintenance.stage", [["name", "=", ETAPA_INGRESA]], ["id"], { limit: 1 });
        await ejecutar("maintenance.request", "write", [[+i], { ...base, x_validacion: "valida", x_ingreso_fecha: aOdoo(ahora), x_ubicacion: UBIC[v.ubicacion], ...(st ? { stage_id: st.id } : {}) }]); }
      else await ejecutar("maintenance.request", "write", [[+i], { ...base, x_validacion: "rechazada", x_rechazo_motivo: v.motivo.trim() }]);
      return this.ingreso(i);
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
