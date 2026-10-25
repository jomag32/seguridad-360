import test from "node:test"; import assert from "node:assert/strict"; import http from "node:http";
process.env.ACCESS_KEY = "PRUEBA7"; process.env.DATA_DIR = "/tmp/s360-test-" + process.pid;
const { app } = await import("../server.js");
const srv = http.createServer(app).listen(0); const base = `http://localhost:${srv.address().port}`;
test.after(() => { srv.closeAllConnections(); srv.close(); });
test("healthz sin clave", async () => assert.equal((await fetch(base + "/healthz")).status, 200));
test("API sin clave → 401", async () => { for (const u of ["/api/semana", "/api/chequeos", "/api/export/chequeos.csv"]) assert.equal((await fetch(base + u)).status, 401); });
test("API con clave mala → 401", async () => assert.equal((await fetch(base + "/api/chequeos", { headers: { "x-access-key": "MAL" } })).status, 401));
test("API con clave → 200 y no guarda foto", async () => {
  const h = { "x-access-key": "prueba7", "content-type": "application/json" };
  assert.equal((await fetch(base + "/api/chequeos", { headers: h })).status, 200);
  const r = await fetch(base + "/api/chequeos", { method: "POST", headers: h, body: JSON.stringify({ movimiento: "Salida a uso", guardia: "G", unidad: "U1", tipo: "Máquina", acceso: "A04", medida: 5, frenos: "OK", luces: "NO", kit: { Matafuego: "Está" }, foto: "x" }) });
  const j = await r.json(); assert.equal(r.status, 201); assert.equal(j.dictamen.resultado, "NO APTO"); assert.equal(j.foto, undefined);
});
