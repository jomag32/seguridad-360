import test from "node:test"; import assert from "node:assert/strict";
import { dictaminar, validarSemana } from "../public/regla.js";
const kitOk = { Matafuego: "Está", Balizas: "Está", Gato: "Está", "Llave de rueda": "Está" };
const base = { movimiento: "Salida a uso", tipo: "Liviano", frenos: "OK", luces: "OK", vtv: "Sí", documentacion: "Sí", kit: kitOk };
test("todo OK → APTO", () => assert.equal(dictaminar(base).resultado, "APTO"));
test("frenos NO → NO APTO bloqueante 'La unidad no sale'", () => { const d = dictaminar({ ...base, frenos: "NO" }); assert.equal(d.resultado, "NO APTO"); assert.ok(d.bloqueante); assert.match(d.texto, /La unidad no sale/); });
test("luces NO no se overridea con autorización", () => { const d = dictaminar({ ...base, luces: "NO", autorizacion: { nombre: "X", motivo: "Y" } }); assert.equal(d.resultado, "NO APTO"); assert.ok(d.bloqueante); });
test("falta kit en salida sin autorización → NO APTO", () => assert.equal(dictaminar({ ...base, kit: { ...kitOk, Gato: "Falta" } }).resultado, "NO APTO"));
test("falta kit con autorización incompleta → NO APTO", () => assert.equal(dictaminar({ ...base, kit: { ...kitOk, Gato: "Falta" }, autorizacion: { nombre: "X", motivo: " " } }).resultado, "NO APTO"));
test("falta kit con autorización en la garita → sigue NO APTO (se autoriza solo en Odoo)", () => { const d = dictaminar({ ...base, kit: { ...kitOk, Gato: "Falta" }, autorizacion: { nombre: "Jefe", motivo: "Urgencia" } }); assert.equal(d.resultado, "NO APTO"); assert.equal(d.bloqueante, false); });
test("VTV No o documentación No → bloqueante; máquina no pide VTV", () => { assert.ok(dictaminar({ ...base, vtv: "No" }).bloqueante); assert.ok(dictaminar({ ...base, documentacion: "No" }).bloqueante); assert.equal(dictaminar({ ...base, tipo: "Máquina", vtv: "", kit: { Matafuego: "Está" } }).resultado, "APTO"); });
test("ítem sin marcar cuenta como faltante", () => assert.equal(dictaminar({ ...base, kit: {} }).resultado, "NO APTO"));
test("retorno con faltante → NO APTO (aviso)", () => assert.equal(dictaminar({ ...base, movimiento: "Retorno de uso", kit: { ...kitOk, Gato: "Falta" } }).resultado, "NO APTO"));
test("semirremolque sin kit → APTO", () => assert.equal(dictaminar({ ...base, tipo: "Semirremolque", kit: {} }).resultado, "APTO"));
test("máquina solo pide matafuego", () => assert.equal(dictaminar({ ...base, tipo: "Máquina", kit: { Matafuego: "Está" } }).resultado, "APTO"));
test("pesado pide cuñas", () => assert.equal(dictaminar({ ...base, tipo: "Pesado", kit: { Matafuego: "Está", Balizas: "Está", "Llave de rueda": "Está" } }).resultado, "NO APTO"));
test("semana: 1 de día y 2 de noche", () => {
  const g = (t, id) => ({ turno: t, guardiaId: id, puesto: "S06" });
  const dias = Array.from({ length: 7 }, (_, i) => ({ fecha: "d" + i, guardias: [g("Día", 1), g("Noche", 2), g("Noche", 3)] }));
  assert.deepEqual(validarSemana({ inicio: "2026-10-26", dias }), []);
  dias[0].guardias.pop(); assert.ok(validarSemana({ inicio: "2026-10-26", dias }).length);
});
import { validarLlave } from "../public/regla.js";
const ll = { unidad: "U1", color: "VERDE", entrego: "Logística", guardiaId: 1, legajo: "L", dni: "1", fechaHora: "2026-10-25T20:30" };
test("llave verde completa OK", () => assert.deepEqual(validarLlave(ll), []));
test("llave: color inválido; amarillo exige restricción u otra", () => {
  assert.ok(validarLlave({ ...ll, color: "AZUL" }).length); assert.ok(validarLlave({ ...ll, color: "AMARILLO" }).length);
  assert.deepEqual(validarLlave({ ...ll, color: "AMARILLO", otra: "Solo dentro del predio" }), []);
});
test("llave: faltan unidad, entregó, guardia y firma", () => assert.equal(validarLlave({ color: "ROJO", fechaHora: "2026-10-25T20:30" }).length, 4));
test("salida con fluido bajo el mínimo → NO APTO bloqueante; Mínimo es APTO; retorno no lo evalúa", () => {
  const f = { frenos: "Mínimo", refrigerante: "Medio", aceite: "Máximo" };
  assert.equal(dictaminar({ ...base, fluidos: f }).resultado, "APTO");
  const d = dictaminar({ ...base, fluidos: { ...f, refrigerante: "Bajo el mínimo" } }); assert.equal(d.resultado, "NO APTO"); assert.ok(d.bloqueante); assert.deepEqual(d.motivos, ["Refrigerante bajo el mínimo"]);
  assert.equal(dictaminar({ ...base, movimiento: "Retorno de uso", fluidos: { ...f, aceite: "Bajo el mínimo" } }).resultado, "APTO");
});
