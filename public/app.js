import { TIPOS, KIT, FLUIDOS, NIVELES, PUESTOS, LLAVEROS, RESTRICCIONES, dictaminar, validarSemana, validarLlave, validarChequeo, PLAZOS_H, ingresoPrevisto, CAUSAS, SISTEMAS, LLEGADAS, PRIORIDADES, FOTOS, fotosExigidas, validarIngreso, validarValidacion, validarFotos, UBICACIONES } from "./regla.js";
const $ = (s) => document.querySelector(s), esc = (s) => String(s ?? "").replace(/[&<>"]/g, (c) => `&#${c.charCodeAt(0)};`);
const opts = (l, sel) => l.map(([v, t]) => `<option value="${v}"${v === sel ? " selected" : ""}>${esc(t)}</option>`).join("");
let clave = localStorage.getItem("s360-clave") || "";
const api = async (u, o) => {
  const r = await fetch(u, { method: o ? "POST" : "GET", headers: { "content-type": "application/json", "x-access-key": clave }, body: o ? JSON.stringify(o) : undefined });
  if (r.status === 401) { localStorage.removeItem("s360-clave"); clave = ""; mostrarIngreso(); throw new Error("sin clave"); }
  const j = await r.json().catch(() => ({ errores: ["Respuesta inválida del servidor"] }));
  return [r.status, j];
};
const errores = (r) => (r?.errores || [r?.error || "No se pudo registrar. Probá de nuevo."]).join(" · ");
let cat = { guardias: [], portones: [], unidades: [] };
const OTRA = "__otra";
async function cargarCatalogos() {
  const [s, c] = await api("/api/catalogos"); if (s !== 200) return; cat = c;
  const g = `<option value="">— Elegí guardia —</option>` + opts(cat.guardias.map((x) => [String(x.id), `${x.nombre} · ${x.empresa}`]));
  $("#c-guardia").innerHTML = g; $("#l-guardia").innerHTML = g; $("#t-guardia").innerHTML = g;
  const u = `<option value="">— Elegí la unidad —</option>` + opts(cat.unidades.map((x) => [String(x.id), x.nombre])) + `<option value="${OTRA}">Otra (escribir)</option>`;
  $("#c-vehiculo").innerHTML = u; $("#l-vehiculo").innerHTML = u; $("#t-vehiculo").innerHTML = u;
  $("#c-porton").innerHTML = `<option value="">— Elegí el portón —</option>` + opts(cat.portones.map((x) => [String(x.id), x.nombre]));
}
function mostrarIngreso() { document.querySelectorAll("body section").forEach((x) => (x.hidden = x.id !== "v-ingreso")); document.querySelector("nav").hidden = true; }
const DIAS = ["Lunes", "Martes", "Miércoles", "Jueves", "Viernes", "Sábado", "Domingo"];
let semana = null;
// ---------- Semana ----------
function lunes(d = new Date()) { const x = new Date(d); x.setDate(x.getDate() - ((x.getDay() + 6) % 7)); return x.toISOString().slice(0, 10); }
function sumar(f, n) { const x = new Date(f + "T12:00"); x.setDate(x.getDate() + n); return x.toISOString().slice(0, 10); }
function armarSemana() {
  const ini = $("#s-inicio").value; let h = "";
  for (let i = 0; i < 7; i++) {
    const f = sumar(ini, i), dd = new Date(f + "T12:00");
    h += `<div class="dia" data-fecha="${f}"><h3>${DIAS[(dd.getDay() + 6) % 7]} ${f.split("-").reverse().join("/")}</h3>`;
    ["Día", "Noche", "Noche"].forEach((t, k) => {
      const prev = semana?.inicio === ini ? semana.dias[i]?.guardias.filter((g) => g.turno === t)[t === "Noche" ? k - 1 : 0] : null;
      h += `<div class="g" data-turno="${t}"><b>Turno ${t}${t === "Noche" ? " · guardia " + k : ""}</b><div class="fila2"><label>Guardia<select class="gg"><option value="">— Elegí guardia —</option>${opts(cat.guardias.map((x) => [String(x.id), `${x.nombre} · ${x.empresa}`]), String(prev?.guardiaId || ""))}</select></label>
      <label>Puesto<select class="gp">${opts(PUESTOS, prev?.puesto || "S06")}</select></label></div></div>`;
    });
    h += "</div>";
  }
  $("#s-dias").innerHTML = h;
}
function leerSemana() {
  return { inicio: $("#s-inicio").value, dias: [...document.querySelectorAll(".dia")].map((d) => ({ fecha: d.dataset.fecha,
    guardias: [...d.querySelectorAll(".g")].map((g) => ({ turno: g.dataset.turno, guardiaId: +g.querySelector(".gg").value || null, puesto: g.querySelector(".gp").value })) })) };
}
$("#s-inicio").onchange = armarSemana;
$("#s-guardar").onclick = async () => {
  const s = leerSemana(), e = validarSemana(s); $("#s-ok").textContent = "";
  $("#s-err").innerHTML = e.slice(0, 6).map(esc).join("<br>") + (e.length > 6 ? `<br>… y ${e.length - 6} más` : ""); if (e.length) return;
  const [c, r] = await api("/api/semana", s); if (c === 201) { $("#s-ok").textContent = "Semana guardada ✔"; await cargarSemana(); } else $("#s-err").textContent = errores(r);
};
async function cargarSemana() {
  semana = (await api("/api/semana"))[1];
}
// ---------- Chequeo ----------
$("#c-tipo").innerHTML = opts(TIPOS.map((t) => [t, t]));
const F = $("#f");
function kit() {
  const t = F.tipo.value, items = KIT[t];
  $("#c-kit").innerHTML = `<legend>Kit · ${t}</legend>` + (items.length ? items.map((i, n) => `<fieldset class="seg kitfila"><legend>${i}</legend>
    <label><input type="radio" name="kit${n}" value="Está">Está</label><label class="no"><input type="radio" name="kit${n}" value="Falta">Falta</label></fieldset>`).join("")
    : `<p class="ayuda">Semirremolque: viaja con el kit del tractor.</p>`);
  const semi = t === "Semirremolque", maq = t === "Máquina";
  $("#c-medlbl").textContent = semi ? "Km (semirremolque = 0)" : maq ? "Horas" : "Km";
  $("#c-medida").readOnly = semi; if (semi) $("#c-medida").value = 0; $("#c-vtvf").hidden = maq;
}
$("#c-fluidos").innerHTML += FLUIDOS.map(([k, t]) => `<fieldset class="seg niveles"><legend>${t}</legend>` +
  NIVELES.map((n, i) => `<label${i ? "" : ' class="no"'}><input type="radio" name="fl_${k}" value="${n}">${n}</label>`).join("") + "</fieldset>").join("");
function datos() {
  const t = F.tipo.value, k = {}; KIT[t].forEach((i, n) => (k[i] = F["kit" + n].value || ""));
  const v = F.vehiculo.value;
  return { movimiento: F.movimiento.value, guardiaId: +F.guardia.value || null, vehiculoId: v && v !== OTRA ? +v : null, unidad: v === OTRA ? F.unidad.value.trim() : "",
    tipo: t, portonId: +F.porton.value || null, medida: F.medida.value === "" ? "" : Number(F.medida.value), frenos: F.frenos.value, luces: F.luces.value,
    vtv: t === "Máquina" ? "" : F.vtv.value, documentacion: F.documentacion.value, kit: k,
    fluidos: F.movimiento.value === "Salida a uso" ? Object.fromEntries(FLUIDOS.map(([f]) => [f, F["fl_" + f].value || ""])) : {}, legajo: F.legajo.value.trim(), dni: F.dni.value.trim(), observaciones: F.observaciones.value.trim(),
    estadoLogistica: F.movimiento.value === "Salida a uso" ? F.estadoLogistica.value : "Apto", gravedad: F.gravedad.value, observacionFalla: F.observacionFalla.value.trim(), ingresoPrevisto: F.ingresoPrevisto.value, logistica: F.logistica.value.trim() };
}
let previstoEditado = false;
F.ingresoPrevisto.addEventListener("input", () => (previstoEditado = true));
F.addEventListener("change", (e) => { if (e.target.name === "gravedad" || e.target.name === "tipo") previstoEditado = false; });
function previsto(c) {
  const pl = cat.plazos || PLAZOS_H, h = pl[c.gravedad]?.[c.tipo];
  $("#c-plazo").textContent = !c.gravedad ? "Elegí la gravedad: la fecha se calcula sola (hoy + plazo) y se puede corregir."
    : h ? `Plazo ${c.gravedad} · ${c.tipo}: ${h} h (parámetro editable en Odoo). Se puede corregir la fecha.` : "Baja: hasta el próximo service programado. Sin fecha automática: Logística la carga (obligatoria).";
  if (!previstoEditado) F.ingresoPrevisto.value = ingresoPrevisto(c.gravedad, c.tipo, new Date(), pl) || "";
}
let espera = null;
function pintar(d, reg) {
  const el = $("#c-dict"), aut = reg?.estado === "salida_autorizada";
  el.className = "dict " + (d.resultado === "APTO CON OBSERVACIÓN" ? "OBS" : d.resultado === "APTO" || aut ? "APTO" : "NO");
  let estado = "";
  if (reg) estado = aut ? `<b>Salida autorizada por ${esc(reg.autorizacion.por)} – ${esc(reg.autorizacion.motivo)}</b>`
    : reg.estado === "bloqueada" ? `<b>BLOQUEADA: la unidad no sale.</b>${!d.bloqueante && reg.movimiento === "Salida a uso" ? "<small>Esperando autorización del Jefe de Logística en Odoo… (se actualiza sola)</small>" : ""}`
    : reg.estado === "liberada" ? "<b>Liberada por un Responsable.</b>" : "";
  el.innerHTML = `<small>${reg ? "Dictamen registrado · " + esc(reg.numero) : "Dictamen"}</small><big>${aut ? "SALIDA AUTORIZADA" : d.resultado}</big>${reg ? "" : `<b>${esc(d.texto)}</b>`}${estado}` +
    (d.motivos.length ? `<small>${d.motivos.map(esc).join(" · ")}</small>` : "") + (d.bloqueante ? `<small>Falla bloqueante: no se puede autorizar (ni el Jefe de Logística).</small>` : "");
}
function esperar(reg) {
  clearInterval(espera); if (!(reg.estado === "bloqueada" && !reg.dictamen.bloqueante && reg.movimiento === "Salida a uso")) return;
  espera = setInterval(async () => { const [s, r] = await api("/api/chequeos/" + reg.id); if (s === 200 && r.estado !== "bloqueada") { clearInterval(espera); pintar(r.dictamen, r); } }, 15000);
}
function actualizar() {
  const c = datos(); $("#c-otra").hidden = F.vehiculo.value !== OTRA; $("#c-fluidos").hidden = c.movimiento !== "Salida a uso";
  $("#c-obs").hidden = c.movimiento !== "Salida a uso"; $("#c-obsdet").hidden = c.estadoLogistica !== "Apto con observación"; if (!$("#c-obsdet").hidden) { previsto(c); c.ingresoPrevisto = F.ingresoPrevisto.value; }
  const listo = c.frenos && c.luces && c.documentacion && (c.tipo === "Máquina" || c.vtv) && Object.values(c.kit).every(Boolean) && Object.values(c.fluidos).every(Boolean);
  const falta = Object.values(c.kit).includes("Falta"), bloq = dictaminar(c).bloqueante;
  $("#c-aut").hidden = !(falta && !bloq && c.movimiento === "Salida a uso");
  if (bloq || listo) pintar(dictaminar(c)); else $("#c-dict").innerHTML = "";
}
F.tipo.onchange = () => { kit(); actualizar(); }; F.oninput = actualizar; F.onchange = actualizar;
F.onsubmit = async (e) => {
  e.preventDefault(); const c = datos(), err = validarChequeo(c);
  $("#c-err").textContent = err.join(" · "); if (err.length) return $("#c-err").scrollIntoView({ behavior: "smooth" });
  $("#c-enviar").disabled = true; const [s, r] = await api("/api/chequeos", c).finally(() => ($("#c-enviar").disabled = false));
  if (s === 201) { pintar(r.dictamen, r); esperar(r); F.legajo.value = F.dni.value = ""; $("#c-dict").scrollIntoView({ behavior: "smooth" }); } else $("#c-err").textContent = errores(r);
};
// ---------- Ingreso a mantenimiento ----------
const fh = (d) => new Date(d).toLocaleString("es-AR", { timeZone: "America/Argentina/Buenos_Aires", hourCycle: "h23", dateStyle: "short", timeStyle: "short" }) + " (hora Arg.)";
const T = $("#t-f");
$("#t-causa").innerHTML = `<option value="">— Elegí la causa —</option>` + opts(CAUSAS.map((x) => [x, x]));
$("#t-sistema").innerHTML = `<option value="">— Elegí el sistema —</option>` + opts(SISTEMAS.map((x) => [x, x]));
$("#t-llegada").innerHTML += LLEGADAS.map((x) => `<label><input type="radio" name="llegada" value="${x}">${x}</label>`).join("");
$("#t-prio").innerHTML += PRIORIDADES.map(([t, v]) => `<label><input type="radio" name="prioridad" value="${v}"><i>${"★".repeat(+v) + "☆".repeat(3 - +v)}</i>${t}</label>`).join("");
$("#t-fotos").innerHTML += FOTOS.map(([k, t]) => `<div class="foto" data-k="${k}"><span>${t}</span><img hidden alt=""><input type="file" accept="image/*" capture="environment"></div>`).join("");
const fotos = {};
// reduce la foto en el teléfono (máx. 1280 px, JPEG) antes de subirla
const achicar = (f) => new Promise((ok) => { const i = new Image(); i.onload = () => { const k = Math.min(1, 1280 / Math.max(i.width, i.height)), cv = document.createElement("canvas");
  cv.width = i.width * k; cv.height = i.height * k; cv.getContext("2d").drawImage(i, 0, 0, cv.width, cv.height); ok(cv.toDataURL("image/jpeg", 0.7)); }; i.src = URL.createObjectURL(f); });
document.querySelectorAll(".foto input").forEach((x) => (x.onchange = async () => { const d = x.closest(".foto"); if (!x.files[0]) return;
  fotos[d.dataset.k] = await achicar(x.files[0]); const im = d.querySelector("img"); im.src = fotos[d.dataset.k]; im.hidden = false; }));
let ultimo = null;
const leerIngreso = () => { const v = T.vehiculo.value; return { vehiculoId: v && v !== OTRA ? +v : null, unidad: v === OTRA ? T.unidad.value.trim() : "", causa: T.causa.value, sistema: T.sistema.value,
  relato: T.relato.value.trim(), declaro: T.declaro.value.trim(), llegada: T.llegada.value, medida: T.medida.value === "" ? "" : Number(T.medida.value), prioridad: T.prioridad.value,
  guardiaId: +T.guardia.value || null, legajo: T.legajo.value.trim(), dni: T.dni.value.trim(), fotos }; };
T.onchange = async (e) => { $("#t-otra").hidden = T.vehiculo.value !== OTRA;
  const req = fotosExigidas(completar ? completar.causa : T.causa.value); document.querySelectorAll(".foto").forEach((d) => d.classList.toggle("req", req.includes(d.dataset.k)));
  if (e?.target?.name === "vehiculo" || e?.target?.name === "unidad") { const i = leerIngreso(); const [s, r] = await api(`/api/ultima-medida?vehiculoId=${i.vehiculoId || ""}&unidad=${encodeURIComponent(i.unidad)}`);
    ultimo = s === 200 ? r.medida : null; $("#t-ultimo").textContent = ultimo != null ? `Último registro: ${ultimo}. No puede ser menor.` : ""; } };
let completar = null; // pedido creado por NO APTO en portón: el guardia completa solo las fotos
async function pendientes() {
  const [s, l] = await api("/api/ingresos/fotos-pendientes"); if (s !== 200) return;
  $("#t-pend").innerHTML = l.length ? `<h2>Fotos pendientes (NO APTO en portón)</h2>` + l.map((x) => `<div class="ing" data-id="${x.id}" data-causa="${esc(x.causa)}"><b>${esc(x.numero)}</b> · ${esc(x.unidad)}<br><small>${esc(x.relato)} · ${esc(x.validacion === "pendiente" ? "a validar" : x.validacion)}</small><div class="bot"><button type="button" class="si">Completar fotos</button></div></div>`).join("") + "<h2>Nuevo ingreso</h2>" : "";
  document.querySelectorAll("#t-pend button").forEach((b) => (b.onclick = () => modo(b.closest(".ing"))));
}
function modo(d) {
  completar = d ? { id: d.dataset.id, causa: d.dataset.causa, numero: d.querySelector("b").textContent } : null;
  $("#t-datos").hidden = !!completar; $("#t-modo").hidden = !completar;
  $("#t-modo").innerHTML = completar ? `Completando fotos de <b>${esc(completar.numero)}</b>. <a href="#taller" id="t-cancel">Cancelar</a>` : "";
  T.querySelector(".prim").textContent = completar ? "Subir fotos del pedido" : "Dar OK de llegada y declarar ingreso";
  document.querySelectorAll(".foto").forEach((x) => x.classList.toggle("req", fotosExigidas(completar ? completar.causa : T.causa.value).includes(x.dataset.k)));
  if (completar) { $("#t-cancel").onclick = (e) => { e.preventDefault(); modo(null); }; T.scrollIntoView(); }
}
T.onsubmit = async (e) => {
  e.preventDefault();
  if (completar) { const f = { fotos, guardiaId: +T.guardia.value || null, legajo: T.legajo.value.trim(), dni: T.dni.value.trim() }, er = validarFotos(f, completar.causa);
    $("#t-err").textContent = er.join(" · "); if (er.length) return;
    const [s, r] = await api(`/api/ingresos/${completar.id}/fotos`, f); if (s !== 200) return ($("#t-err").textContent = errores(r));
    const el = $("#t-res"); el.className = "dict APTO"; el.innerHTML = `<small>${esc(r.numero)}</small><big>FOTOS OK</big><b>Fotos subidas al pedido en Odoo › Mantenimiento</b>`;
    T.legajo.value = T.dni.value = ""; modo(null); pendientes(); return; }
  const i = leerIngreso(), err = validarIngreso(i, ultimo); $("#t-err").textContent = err.join(" · "); if (err.length) return;
  const [s, r] = await api("/api/ingresos", i);
  if (s === 201) { const el = $("#t-res"); el.className = "dict OBS"; el.innerHTML = `<small>Ingreso declarado · ${esc(r.numero)}</small><big>A VALIDAR</big><b>OK del guardia ${esc(r.guardia)} · ${fh(r.okGuardia)}</b><small>Logística tiene que validar la causa (mismo día).</small>`;
    T.legajo.value = T.dni.value = ""; el.scrollIntoView({ behavior: "smooth" }); } else $("#t-err").textContent = errores(r);
};
// ---------- Validación de Logística ----------
async function logistica() {
  const [s, l] = await api("/api/ingresos?todos=1"); if (s !== 200) return;
  $("#v-lista").innerHTML = l.length ? l.map((x) => `<div class="ing ${x.validacion}" data-id="${x.id}"><b>${esc(x.numero)}</b> · ${esc(x.unidad)}${x.equipo ? " · equipo " + esc(x.equipo) : ""}<br>
    Causa: <b>${esc(x.causa)}</b> · ${esc(x.sistema)} · <i style="color:#f59e0b">${"★".repeat(+x.prioridad)}</i> ${esc(x.gravedad)}<br><small>«${esc(x.relato)}» · declaró ${esc(x.declaro)} · llega ${esc(x.llegada)} · ${x.medida} km/h${x.fotosPendientes ? " · <b>fotos pendientes</b>" : ""}<br>
    OK guardia ${esc(x.guardia)} · ${fh(x.okGuardia)} · etapa: ${esc(x.etapa)}</small>
    ${x.validacion === "pendiente" ? `<label>Ubicación (si valida)<select class="ubi">${opts(UBICACIONES.map((u) => [u, u]), "Taller propio")}</select></label><label>Motivo (si no valida)<input class="mot"></label><div class="bot"><button class="si">Valida: ingresa</button><button class="no">No valida: a Playa</button></div>`
    : x.validacion === "valida" ? `<br><b>✔ Validó ${esc(x.validoPor)} · ingresó ${fh(x.ingresoFecha)} · corre el plazo</b><label>Ubicación<select class="ubi-cambio">${opts(UBICACIONES.map((u) => [u, u]), x.ubicacion)}</select></label>`
    : `<br><b>✖ No validó ${esc(x.validoPor)}: ${esc(x.motivoRechazo)} · vuelve a Playa disponible (declaró ${esc(x.declaro)})</b>`}</div>`).join("") : "<p>No hay ingresos.</p>";
  document.querySelectorAll(".ing button").forEach((b) => (b.onclick = async () => {
    const d = b.closest(".ing"), v = { valida: b.classList.contains("si"), por: $("#v-por").value.trim(), motivo: d.querySelector(".mot").value.trim(), ubicacion: d.querySelector(".ubi").value };
    const e = validarValidacion(v); $("#v-err").textContent = e.join(" · "); if (e.length) return;
    const [s2, r2] = await api(`/api/ingresos/${d.dataset.id}/validacion`, v); if (s2 !== 200) return ($("#v-err").textContent = errores(r2)); logistica();
  }));
  document.querySelectorAll(".ubi-cambio").forEach((x) => (x.onchange = async () => { const [s3, r3] = await api(`/api/ingresos/${x.closest(".ing").dataset.id}/ubicacion`, { ubicacion: x.value }); $("#v-err").textContent = s3 === 200 ? "" : errores(r3); }));
}
// ---------- Devolución de llave ----------
const L = $("#l-f");
$("#l-checks").innerHTML = RESTRICCIONES.map((r) => `<label class="chk"><input type="checkbox" name="restr" value="${r}">${r}</label>`).join("");
const ahora = () => { const d = new Date(); d.setMinutes(d.getMinutes() - d.getTimezoneOffset()); return d.toISOString().slice(0, 16); };
L.fechaHora.value = ahora();
const leerLlave = () => { const v = L.vehiculo.value; return { vehiculoId: v && v !== OTRA ? +v : null, unidad: v === OTRA ? L.unidad.value.trim() : "", color: L.color.value,
  restricciones: [...L.querySelectorAll("[name=restr]:checked")].map((x) => x.value), otra: L.otra.value.trim(), entrego: L.entrego.value.trim(), guardiaId: +L.guardia.value || null,
  fechaHora: L.fechaHora.value, legajo: L.legajo.value.trim(), dni: L.dni.value.trim(), observaciones: L.observaciones.value.trim() }; };
function pintarLlave(l, final) {
  const el = $("#l-res"); if (!l.color) return (el.innerHTML = "");
  el.className = "dict " + l.color;
  const rs = l.color === "AMARILLO" ? [...l.restricciones, l.otra].filter(Boolean) : [];
  el.innerHTML = `<small>${final ? "Devolución registrada" : "Llavero"}</small><big>${l.color}</big><b>${esc(LLAVEROS[l.color])}</b>${rs.length ? `<small>${rs.map(esc).join(" · ")}</small>` : ""}`;
}
L.onchange = L.oninput = () => { const l = leerLlave(); $("#l-restr").hidden = l.color !== "AMARILLO"; $("#l-otra").hidden = L.vehiculo.value !== OTRA; pintarLlave(l); };
L.onsubmit = async (e) => {
  e.preventDefault(); const l = leerLlave(), err = validarLlave({ ...l, fechaHora: l.fechaHora && l.fechaHora + ":00" });
  $("#l-err").textContent = err.join(" · "); if (err.length) return;
  const [s, r] = await api("/api/llaves", l);
  if (s === 201) { pintarLlave(r, true); L.legajo.value = L.dni.value = ""; $("#l-res").scrollIntoView({ behavior: "smooth" }); } else $("#l-err").textContent = errores(r);
};
// ---------- Registros ----------
async function registros() {
  const [, ch] = await api("/api/chequeos"); const [, ll] = await api("/api/llaves"); await cargarSemana();
  $("#r-llave").innerHTML = ll.length ? ll.slice(0, 20).map((l) => `<div class="reg ${l.color}"><b>${l.color}</b> · ${esc(l.unidad)} · entregó ${esc(l.entrego)} · recibió ${esc(l.guardia)}<br>
    <small>${new Date(l.fechaHora).toLocaleString("es-AR")}${l.restricciones.length || l.otra ? " · " + [...l.restricciones, l.otra].filter(Boolean).map(esc).join(", ") : ""}</small></div>`).join("") : "<p>Sin devoluciones.</p>";
  $("#r-cheq").innerHTML = ch.length ? ch.slice(0, 20).map((c) => `<div class="reg ${c.dictamen.resultado.startsWith("APTO") || c.estado === "salida_autorizada" ? "" : "NO"}"><b>${c.dictamen.resultado}</b> · ${esc(c.estadoTexto)} · ${esc(c.numero)} · ${esc(c.movimiento)} · ${esc(c.unidad)} (${esc(c.tipo)}) · ${esc(c.acceso)}<br>
    <small>${new Date(c.fecha).toLocaleString("es-AR")} · ${esc(c.guardia)}${c.dictamen.motivos.length ? " · " + c.dictamen.motivos.map(esc).join(", ") : ""}${c.autorizacion ? `<br><b>Salida autorizada por ${esc(c.autorizacion.por)} – ${esc(c.autorizacion.motivo)}</b>` : ""}</small></div>`).join("") : "<p>Sin chequeos.</p>";
  $("#r-guard").innerHTML = semana ? semana.dias.map((d) => `<div class="reg"><b>${d.fecha.split("-").reverse().join("/")}</b><br>${d.guardias.map((g) => `${g.turno}: ${esc(g.nombre)} (${esc(g.empresa)}) · ${g.puesto}`).join("<br>")}</div>`).join("") : "<p>No hay semana cargada.</p>";
}
// ---------- Rutas ----------
function ruta() {
  if (!clave) return mostrarIngreso(); document.querySelector("nav").hidden = false; $("#v-ingreso").hidden = true;
  const v = (location.hash || "#chequeo").slice(1);
  ["semana", "chequeo", "taller", "logistica", "llave", "registros"].forEach((x) => ($("#v-" + x).hidden = x !== v));
  document.querySelectorAll("nav a").forEach((a) => a.classList.toggle("act", a.hash === "#" + v));
  if (v === "registros") registros(); if (v === "logistica") logistica(); if (v === "taller") pendientes();
}
addEventListener("hashchange", ruta);
$("#i-f").onsubmit = async (e) => {
  e.preventDefault(); const k = $("#i-clave").value.trim().toUpperCase();
  const r = await fetch("/api/catalogos", { headers: { "x-access-key": k } });
  if (r.status === 401) return ($("#i-err").textContent = "Clave de acceso incorrecta");
  if (!r.ok) return ($("#i-err").textContent = "No se pudo conectar con Odoo. Probá de nuevo en un minuto.");
  clave = k; localStorage.setItem("s360-clave", k); iniciar();
};
async function descargar(u, nombre) {
  const r = await fetch(u, { headers: { "x-access-key": clave } }); if (!r.ok) return;
  const a = document.createElement("a"); a.href = URL.createObjectURL(await r.blob()); a.download = nombre; a.click();
}
$("#x-cheq").onclick = (e) => { e.preventDefault(); descargar("/api/export/chequeos.csv", "seguridad-360-chequeos.csv"); };
$("#x-guard").onclick = (e) => { e.preventDefault(); descargar("/api/export/guardias.csv", "seguridad-360-guardias.csv"); };
$("#x-ing").onclick = (e) => { e.preventDefault(); descargar("/api/export/ingresos.csv", "seguridad-360-ingresos.csv"); };
$("#x-llave").onclick = (e) => { e.preventDefault(); descargar("/api/export/llaves.csv", "seguridad-360-llaves.csv"); };
$("#s-inicio").value = lunes(); kit();
const iniciar = () => cargarCatalogos().then(cargarSemana).then(() => { if (semana) $("#s-inicio").value = semana.inicio; armarSemana(); ruta(); }).catch(() => {});
if (clave) iniciar(); else mostrarIngreso();
