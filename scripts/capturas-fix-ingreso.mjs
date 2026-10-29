// Capturas «fix ingreso duplicado» contra scripts/servidor-falso.js (Odoo falso). Unidad inventada, foto generada.
import { chromium } from "playwright-core";
const b = await chromium.launch({ executablePath: "/usr/bin/google-chrome", args: ["--no-sandbox"] });
const p = await b.newPage({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
const D = new URL("../capturas/", import.meta.url).pathname, U = "http://localhost:" + (process.env.PORT || 8361) + "/", img = process.env.FOTO || "/tmp/foto-fusiblera.jpg";
await p.goto(U); await p.fill("#i-clave", process.env.ACCESS_KEY || "PRUEBA7"); await p.click("#i-f button");
await p.goto(U + "#taller"); await p.waitForSelector("#t-guardia option:nth-child(2)", { state: "attached" });
async function cargar() {
  await p.selectOption("#t-vehiculo", "__otra"); await p.fill("#t-f [name=unidad]", "KPG-TEST"); await p.selectOption("#t-causa", "Daño o accidente"); await p.selectOption("#t-sistema", { index: 1 });
  await p.fill("#t-f [name=relato]", "se incendió la fusiblera"); await p.fill("#t-f [name=declaro]", "Chofer de prueba"); await p.check("#t-llegada input >> nth=0");
  await p.fill("#t-f [name=medida]", "2000"); await p.check("#t-prio input >> nth=2");
  for (const x of await p.locator("#t-fotos .foto input").all()) await x.setInputFiles(img);
  await p.selectOption("#t-guardia", "1"); await p.fill("#t-f [name=legajo]", "L-10"); await p.fill("#t-f [name=dni]", "20111222"); await p.waitForTimeout(400);
}
await cargar();
await p.route("**/api/ingresos", async (r) => { await new Promise((ok) => setTimeout(ok, 1500)); r.continue(); });
await p.click("#t-f .prim"); await p.waitForTimeout(300); await p.locator("#t-f .prim").scrollIntoViewIfNeeded();
await p.screenshot({ path: D + "fix-ingreso-1-enviando-boton-deshabilitado.png" });
await p.waitForSelector("#t-res big:has-text('INGRESO REGISTRADO')"); await p.unroute("**/api/ingresos"); await p.waitForTimeout(300);
await p.screenshot({ path: D + "fix-ingreso-2-registrado-y-confirmacion.png" });
await p.evaluate(() => scrollTo(0, 0)); await p.screenshot({ path: D + "fix-ingreso-3-formulario-limpio.png", fullPage: true });
await cargar(); await p.click("#t-f .prim"); await p.waitForSelector("#t-err:has-text('ya tiene un ingreso abierto')"); await p.locator("#t-err").scrollIntoViewIfNeeded();
await p.screenshot({ path: D + "fix-ingreso-4-duplicado-rechazado.png" });
await p.goto(U + "#logistica"); await p.reload(); await p.waitForSelector(".ing"); await p.screenshot({ path: D + "fix-ingreso-5-logistica-relato-sin-html.png", fullPage: true });
// chequeo de portón: después de registrar, todo el formulario queda limpio
await p.goto(U + "#chequeo"); await p.reload(); await p.waitForSelector("#c-guardia option:nth-child(2)", { state: "attached" });
await p.check("[name=movimiento][value='Salida a uso']").catch(() => {});
await p.selectOption("#c-guardia", "1"); await p.selectOption("#c-vehiculo", "__otra"); await p.fill("#f [name=unidad]", "CHQ-TEST"); await p.selectOption("#c-porton", { index: 1 }); await p.fill("#c-medida", "500");
for (const s of ["frenos][value=OK", "luces][value=OK", "humo][value=No", "vtv][value=Sí", "documentacion][value=Sí"]) await p.check(`[name=${s}]`);
for (const n of [0, 1, 2, 3]) await p.check(`[name=kit${n}][value=Está]`);
for (const x of await p.locator("#c-fluidos input[value=Máximo]").all()) await x.check();
await p.setInputFiles(".fch[data-k=f1] input", img); await p.fill("#f [name=legajo]", "L-10"); await p.fill("#f [name=dni]", "20111222");
await p.click("#c-enviar"); await p.waitForSelector("#c-dict small:has-text('formulario quedó limpio')", { timeout: 8000 }).catch(async () => console.log("ERR chequeo:", await p.textContent("#c-err")));
await p.screenshot({ path: D + "fix-ingreso-6-chequeo-limpio-tras-registrar.png", fullPage: true });
await b.close();
