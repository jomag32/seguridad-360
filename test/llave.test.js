import test from "node:test"; import assert from "node:assert/strict"; import http from "node:http";
import { validarLlave } from "../public/regla.js";
const ok = { unidad: "U1", color: "VERDE", entrego: "Logística", guardia: "G1", fechaHora: "2026-10-25T20:30" };
test("llave verde completa OK", () => assert.deepEqual(validarLlave(ok), []));
test("color inválido o faltante", () => { assert.ok(validarLlave({ ...ok, color: "AZUL" }).length); assert.ok(validarLlave({ ...ok, color: "" }).length); });
test("amarillo exige restricción u otra", () => {
  assert.ok(validarLlave({ ...ok, color: "AMARILLO" }).length);
  assert.deepEqual(validarLlave({ ...ok, color: "AMARILLO", restricciones: ["No salir a ruta"] }), []);
  assert.deepEqual(validarLlave({ ...ok, color: "AMARILLO", otra: "Solo dentro del predio" }), []);
});
test("faltan unidad, entregó o guardia", () => assert.equal(validarLlave({ color: "ROJO", fechaHora: "2026-10-25T20:30" }).length, 3));
process.env.ACCESS_KEY = "PRUEBA7"; process.env.DATA_DIR = "/tmp/s360-llave-" + process.pid;
const { app } = await import("../server.js");
const srv = http.createServer(app).listen(0); const base = `http://localhost:${srv.address().port}`;
test.after(() => { srv.closeAllConnections(); srv.close(); });
test("API llaves: 401 sin clave, alta, CSV, borrado", async () => {
  assert.equal((await fetch(base + "/api/llaves")).status, 401);
  const h = { "x-access-key": "PRUEBA7", "content-type": "application/json" };
  const r = await fetch(base + "/api/llaves", { method: "POST", headers: h, body: JSON.stringify({ ...ok, color: "ROJO", restricciones: ["No salir a ruta"] }) });
  const j = await r.json(); assert.equal(r.status, 201); assert.deepEqual(j.restricciones, []);
  assert.match(await (await fetch(base + "/api/export/llaves.csv", { headers: h })).text(), /ROJO/);
  assert.equal((await fetch(base + "/api/llaves/" + j.id, { method: "DELETE", headers: h })).status, 200);
  assert.equal((await (await fetch(base + "/api/llaves", { headers: h })).json()).length, 0);
});
