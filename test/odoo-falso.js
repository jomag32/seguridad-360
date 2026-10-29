// Odoo falso en memoria (execute_kw) para los tests. Emula numeración y las reglas R-S360-1 / R-S360-3.
import { ErrorOdoo } from "../odoo.js";
export function odooFalso() {
  const db = { x_seg360_guardia: [{ id: 1, x_name: "Guardia Uno", x_legajo: "L-10", x_dni: "20.111.222", x_empresa: "Empresa Prueba", x_active: true },
      { id: 2, x_name: "Guardia Dos", x_legajo: "L-11", x_dni: "30111222", x_empresa: "Empresa Prueba", x_active: true },
      { id: 3, x_name: "Guardia Tres", x_legajo: "L-12", x_dni: "40111222", x_empresa: "Empresa Prueba", x_active: true }],
    x_seg360_porton: [{ id: 2, x_codigo: "A02", x_name: "A02 · Portón Playa 1", x_tipo: "vehiculos", x_active: true }, { id: 1, x_codigo: "A01", x_name: "A01 · Puerta peatonal", x_tipo: "peatonal", x_active: true }],
    "fleet.vehicle": [{ id: 5, license_plate: "AA000AA", display_name: "Unidad de prueba" }], x_seg360_semana: [], x_seg360_turno: [], x_seg360_chequeo: [], x_seg360_llave: [], "ir.config_parameter": [{ id: 1, key: "seg360.plazo.media.liviano", value: "60" }],
    "maintenance.equipment": [{ id: 40, name: "Unidad de prueba (equipo)", x_vehiculo_id: 5 }],
    "maintenance.stage": [{ id: 9, name: "Ingreso a validar (Logística)" }, { id: 1, name: "A iniciar" }, { id: 2, name: "En progreso" }],
    "maintenance.request": [], "ir.attachment": [] };
  let sec = 100;
  const m2o = { x_guardia_id: "x_seg360_guardia", x_porton_id: "x_seg360_porton", x_vehiculo_id: "fleet.vehicle", x_semana_id: "x_seg360_semana", x_aut_salida_por_id: "res.users", equipment_id: "maintenance.equipment", stage_id: "maintenance.stage", x_chequeo_id: "x_seg360_chequeo", x_ingreso_id: "maintenance.request" };
  const ver = (mo, r) => { const o = { ...r }; for (const [f, rel] of Object.entries(m2o)) if (f in o) { const t = (db[rel] || [{ id: o[f], x_name: "Autorizante" }]).find((x) => x.id === o[f]);
    o[f] = o[f] && t ? [t.id, t.x_name || t.display_name || t.name] : false; } return o; };
  const ok = (r, [f, op, v]) => op === "=" ? (r[f] ?? false) === v : op === "=ilike" ? String(r[f] || "").toLowerCase() === String(v).toLowerCase() : op === "in" ? v.includes(r[f]) : op === "!=" ? (r[f] ?? false) !== v : true;
  const filtrar = (mo, dom) => db[mo].filter((r) => dom.every((d) => ok(r, d)));
  const err = (msg) => new ErrorOdoo("Odoo: odoo.exceptions.UserError", { tipo: "odoo.exceptions.UserError", detalle: msg });
  async function ejecutar(mo, me, args = [], kw = {}) {
    if (me === "search_read") { let r = filtrar(mo, args[0]); if (/desc/.test(kw.order || "")) r = [...r].reverse(); if (kw.limit) r = r.slice(0, kw.limit); return r.map((x) => ver(mo, x)); }
    if (me === "read") return args[0].map((i) => db[mo].find((x) => x.id === i)).filter(Boolean).map((x) => ver(mo, x));
    if (me === "search") return filtrar(mo, args[0]).map((x) => x.id);
    if (me === "write" && mo === "x_seg360_chequeo") throw new Error("AccessError: Servicio API sin escritura en x_seg360_chequeo (como en Odoo)");
    if (me === "write") { db[mo].filter((x) => args[0].includes(x.id)).forEach((x) => Object.assign(x, args[1])); return true; }
    if (me === "unlink") { db[mo] = db[mo].filter((x) => !args[0].includes(x.id)); return true; }
    if (me === "create") {
      const vals = Array.isArray(args[0]) ? args[0] : [args[0]]; const ids = [];
      for (const v of vals) {
        const r = { ...v, id: ++sec, create_date: "2026-10-26 01:00:00" };
        if (mo === "x_seg360_chequeo") {
          const mism = (x) => (r.x_vehiculo_id ? x.x_vehiculo_id === r.x_vehiculo_id : !x.x_vehiculo_id && String(x.x_unidad_texto).toLowerCase() === String(r.x_unidad_texto).toLowerCase());
          if (r.x_movimiento === "salida" && db.x_seg360_chequeo.some((x) => mism(x) && x.x_estado === "bloqueada")) throw err("Unidad bloqueada por CHQ (NO APTO): no puede salir.");
          const ll = db.x_seg360_llave.filter(mism).pop();
          if (r.x_movimiento === "salida" && ll?.x_color === "rojo" && !ll.x_rojo_liberado) throw err("Llavero ROJO en LLV: la unidad no puede salir.");
          r.x_estado = r.x_dictamen === "no_apto" ? "bloqueada" : "habilitada";
        }
        if (r.x_name === "/") r.x_name = { x_seg360_chequeo: "CHQ-", x_seg360_llave: "LLV-", x_seg360_semana: "SEM-" }[mo] + r.id;
        if (mo === "maintenance.request") r.name = "MNT-" + r.id + " · " + r.name;
        db[mo].push(r); ids.push(r.id);
      }
      return Array.isArray(args[0]) ? ids : ids[0];
    }
    throw new Error("método no emulado " + me);
  }
  return { ejecutar, db };
}
