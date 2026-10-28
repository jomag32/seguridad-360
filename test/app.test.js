import test from "node:test"; import assert from "node:assert/strict"; import http from "node:http";
import { crearApp } from "../server.js"; import { crearDatos } from "../datos-odoo.js"; import { odooFalso } from "./odoo-falso.js";
process.env.ACCESS_KEY = "PRUEBA7";
const o = odooFalso(); const srv = http.createServer(crearApp(crearDatos(o.ejecutar))).listen(0); const base = `http://localhost:${srv.address().port}`;
test.after(() => { srv.closeAllConnections(); srv.close(); });
const h = { "x-access-key": "prueba7", "content-type": "application/json" };
const post = async (u, b) => { const r = await fetch(base + u, { method: "POST", headers: h, body: JSON.stringify(b) }); return [r.status, await r.json()]; };
const get = async (u) => { const r = await fetch(base + u, { headers: h }); return [r.status, await r.json()]; };
const chq = { movimiento: "Salida a uso", guardiaId: 1, legajo: "l-10", dni: "20111222", vehiculoId: 5, tipo: "Liviano", portonId: 2, medida: 1200, frenos: "OK", luces: "OK",
  vtv: "Sí", documentacion: "Sí", kit: { Matafuego: "Está", Balizas: "Está", Gato: "Está", "Llave de rueda": "Está" },
  fluidos: { frenos: "Medio", refrigerante: "Máximo", aceite: "Mínimo" } };
test("healthz sin clave; API sin clave o con clave mala → 401", async () => {
  assert.equal((await fetch(base + "/healthz")).status, 200);
  for (const u of ["/api/semana", "/api/chequeos", "/api/catalogos", "/api/export/chequeos.csv"]) assert.equal((await fetch(base + u)).status, 401);
  assert.equal((await fetch(base + "/api/chequeos", { headers: { "x-access-key": "MAL" } })).status, 401);
});
test("catálogos desde Odoo sin DNI ni legajo; portón peatonal fuera", async () => {
  const [s, c] = await get("/api/catalogos"); assert.equal(s, 200);
  assert.equal(c.guardias.length, 3); assert.equal(JSON.stringify(c).includes("20111222") || JSON.stringify(c).includes("L-10"), false);
  assert.deepEqual(c.portones.map((p) => p.codigo), ["A02"]); assert.equal(c.unidades[0].id, 5);
});
test("chequeo: mensajes en castellano si falta guardia/portón/firma (no «seleccioná un elemento»)", async () => {
  const [s, r] = await post("/api/chequeos", { ...chq, guardiaId: null, portonId: null, legajo: "" });
  assert.equal(s, 422); assert.match(r.errores.join(), /Elegí el guardia/); assert.match(r.errores.join(), /Elegí el portón/); assert.match(r.errores.join(), /Firma/);
});
test("firma con DNI equivocado → 422", async () => { const [s, r] = await post("/api/chequeos", { ...chq, dni: "1" }); assert.equal(s, 422); assert.match(r.errores[0], /no coinciden/); });
test("APTO → habilitada, sin foto, guardado en Odoo con firma verificada", async () => {
  const [s, r] = await post("/api/chequeos", { ...chq, foto: "x" }); assert.equal(s, 201);
  assert.equal(r.dictamen.resultado, "APTO"); assert.equal(r.estado, "habilitada"); assert.equal(r.firmaVerificada, true); assert.equal(r.foto, undefined);
  const g = o.db.x_seg360_chequeo.at(-1); assert.equal(g.x_firma_legajo, "L-10"); assert.equal(g.x_dni, undefined); assert.equal(g.x_porton_id, 2);
});
test("NO APTO por kit → bloqueada; la siguiente salida se rechaza; autorización en Odoo se ve en la app", async () => {
  const [s, r] = await post("/api/chequeos", { ...chq, vehiculoId: null, unidad: "INT-07", kit: { ...chq.kit, "Llave de rueda": "Falta" }, autorizacion: { nombre: "x", motivo: "y" } });
  assert.equal(s, 201); assert.equal(r.dictamen.resultado, "NO APTO"); assert.equal(r.dictamen.bloqueante, false); assert.equal(r.estado, "bloqueada");
  const [s2, r2] = await post("/api/chequeos", { ...chq, vehiculoId: null, unidad: "int-07" }); assert.equal(s2, 409); assert.match(r2.errores[0], /bloqueada/);
  const reg = o.db.x_seg360_chequeo.find((x) => x.id === r.id); Object.assign(reg, { x_estado: "salida_autorizada", x_aut_salida_por_id: 15, x_aut_salida_motivo: "faltante revisado" });
  const [, v] = await get("/api/chequeos/" + r.id); assert.equal(v.estado, "salida_autorizada"); assert.equal(v.autorizacion.motivo, "faltante revisado"); assert.ok(v.autorizacion.por);
});
test("VTV o documentación en No → NO APTO bloqueante (no autorizable)", async () => {
  for (const x of [{ vtv: "No" }, { documentacion: "No" }, { frenos: "NO" }]) {
    const [s, r] = await post("/api/chequeos", { ...chq, movimiento: "Retorno de uso", ...x }); assert.equal(s, 201); assert.equal(r.dictamen.bloqueante, true, JSON.stringify(x));
  }
});
test("llave: firma, ROJO bloquea la salida hasta una VERDE posterior, CSV", async () => {
  const ll = { vehiculoId: null, unidad: "U-9", color: "ROJO", entrego: "Logística", guardiaId: 2, legajo: "L-11", dni: "30111222", fechaHora: "2026-10-25T20:30" };
  let [s, r] = await post("/api/llaves", { ...ll, dni: "9" }); assert.equal(s, 422);
  [s, r] = await post("/api/llaves", { ...ll, restricciones: ["No salir a ruta"] }); assert.equal(s, 201); assert.deepEqual(r.restricciones, []);
  assert.equal(o.db.x_seg360_llave.at(-1).x_fecha_hora, "2026-10-25 23:30:00");
  [s] = await post("/api/chequeos", { ...chq, vehiculoId: null, unidad: "U-9" }); assert.equal(s, 409);
  [s] = await post("/api/llaves", { ...ll, color: "VERDE" }); assert.equal(s, 201);
  [s] = await post("/api/chequeos", { ...chq, vehiculoId: null, unidad: "U-9" }); assert.equal(s, 201);
  const t = await (await fetch(base + "/api/export/llaves.csv", { headers: h })).text(); assert.match(t, /ROJO/); assert.match(t, /VERDE/);
});
test("semana con guardias del maestro: guarda turnos en Odoo y la devuelve", async () => {
  const dias = Array.from({ length: 7 }, (_, i) => ({ fecha: `2026-10-${26 + i > 31 ? "0" + (26 + i - 31) : 26 + i}`, guardias: [{ turno: "Día", guardiaId: 1 }, { turno: "Noche", guardiaId: 2 }, { turno: "Noche", guardiaId: 3 }] }));
  let [s, r] = await post("/api/semana", { inicio: "2026-10-26", dias: dias.map((d, i) => i ? d : { ...d, guardias: [d.guardias[0], d.guardias[1], d.guardias[1]] }) }); assert.equal(s, 422); assert.match(r.errores.join(), /repetido/);
  [s] = await post("/api/semana", { inicio: "2026-10-26", dias }); assert.equal(s, 201);
  [s] = await post("/api/semana", { inicio: "2026-10-26", dias }); assert.equal(s, 201); assert.equal(o.db.x_seg360_turno.length, 21);
  const [, w] = await get("/api/semana"); assert.equal(w.dias.length, 7); assert.equal(w.dias[0].guardias[0].nombre, "Guardia Uno"); assert.equal(w.dias[0].guardias[0].empresa, "Empresa Prueba");
  assert.match(await (await fetch(base + "/api/export/guardias.csv", { headers: h })).text(), /Guardia Dos/);
});
test("sin Odoo configurado → 503 con mensaje", async () => {
  const s2 = http.createServer(crearApp(null)).listen(0); const r = await fetch(`http://localhost:${s2.address().port}/api/semana`, { headers: h }); s2.close();
  assert.equal(r.status, 503);
});

test("salida: falta nivel de fluidos → 422; fluido bajo el mínimo → NO APTO bloqueante y se guarda en Odoo", async () => {
  const [s1, r1] = await post("/api/chequeos", { ...chq, vehiculoId: null, unidad: "FL-001", fluidos: { frenos: "Medio" } });
  assert.equal(s1, 422); assert.match(r1.errores.join(), /fluidos/);
  const [s2, r2] = await post("/api/chequeos", { ...chq, vehiculoId: null, unidad: "FL-002", fluidos: { ...chq.fluidos, aceite: "Bajo el mínimo" } });
  assert.equal(s2, 201); assert.equal(r2.dictamen.resultado, "NO APTO"); assert.ok(r2.dictamen.bloqueante); assert.ok(r2.dictamen.motivos.includes("Aceite de motor bajo el mínimo"));
  assert.equal(r2.fluidos.aceite, "Bajo el mínimo"); assert.equal(r2.fluidos.frenos, "Medio");
  const [s3, r3] = await post("/api/chequeos", { ...chq, movimiento: "Retorno de uso", vehiculoId: null, unidad: "FL-003", fluidos: undefined });
  assert.equal(s3, 201); assert.deepEqual(r3.fluidos, {});
});
