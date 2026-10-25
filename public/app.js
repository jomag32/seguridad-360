import { TIPOS, KIT, ACCESOS, PUESTOS, dictaminar, validarSemana } from "./regla.js";
const $ = (s) => document.querySelector(s), esc = (s) => String(s ?? "").replace(/[&<>"]/g, (c) => `&#${c.charCodeAt(0)};`);
const opts = (l, sel) => l.map(([v, t]) => `<option value="${v}"${v === sel ? " selected" : ""}>${esc(t)}</option>`).join("");
const api = async (u, o) => { const r = await fetch(u, o && { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(o) }); return [r.status, await r.json()]; };
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
      h += `<div class="g" data-turno="${t}"><b>Turno ${t}${t === "Noche" ? " · guardia " + k : ""}</b><label>Nombre y apellido<input class="gn" value="${esc(prev?.nombre)}"></label>
      <div class="fila2"><label>Empresa<input class="ge" value="${esc(prev?.empresa)}"></label><label>Puesto<select class="gp">${opts(PUESTOS, prev?.puesto || "S06")}</select></label></div></div>`;
    });
    h += "</div>";
  }
  $("#s-dias").innerHTML = h;
}
function leerSemana() {
  return { inicio: $("#s-inicio").value, dias: [...document.querySelectorAll(".dia")].map((d) => ({ fecha: d.dataset.fecha,
    guardias: [...d.querySelectorAll(".g")].map((g) => ({ turno: g.dataset.turno, nombre: g.querySelector(".gn").value.trim(), empresa: g.querySelector(".ge").value.trim(), puesto: g.querySelector(".gp").value })) })) };
}
$("#s-inicio").onchange = armarSemana;
$("#s-guardar").onclick = async () => {
  const s = leerSemana(), e = validarSemana(s); $("#s-ok").textContent = "";
  $("#s-err").innerHTML = e.slice(0, 6).map(esc).join("<br>") + (e.length > 6 ? `<br>… y ${e.length - 6} más` : ""); if (e.length) return;
  const [c, r] = await api("/api/semana", s); if (c === 201) { $("#s-ok").textContent = "Semana guardada ✔"; await cargarSemana(); } else $("#s-err").textContent = (r.errores || ["Error"]).join(" · ");
};
async function cargarSemana() {
  semana = (await api("/api/semana"))[1];
  const nombres = [...new Set((semana?.dias || []).flatMap((d) => d.guardias.map((g) => g.nombre)))];
  $("#c-guardia").innerHTML = `<option value="">— Elegí guardia —</option>` + opts(nombres.map((n) => [n, n]));
}
// ---------- Chequeo ----------
$("#c-tipo").innerHTML = opts(TIPOS.map((t) => [t, t])); $("#c-acceso").innerHTML = opts(ACCESOS, "A02");
const F = $("#f"); let foto = null;
function kit() {
  const t = F.tipo.value, items = KIT[t];
  $("#c-kit").innerHTML = `<legend>Kit · ${t}</legend>` + (items.length ? items.map((i, n) => `<fieldset class="seg kitfila"><legend>${i}</legend>
    <label><input type="radio" name="kit${n}" value="Está">Está</label><label class="no"><input type="radio" name="kit${n}" value="Falta">Falta</label></fieldset>`).join("")
    : `<p class="ayuda">Semirremolque: viaja con el kit del tractor.</p>`);
  const semi = t === "Semirremolque", maq = t === "Máquina";
  $("#c-medlbl").textContent = semi ? "Km (semirremolque = 0)" : maq ? "Horas" : "Km";
  $("#c-medida").readOnly = semi; if (semi) $("#c-medida").value = 0;
}
function datos() {
  const t = F.tipo.value, k = {}; KIT[t].forEach((i, n) => (k[i] = F["kit" + n].value || ""));
  return { movimiento: F.movimiento.value, guardia: F.guardia.value, unidad: F.unidad.value.trim(), tipo: t, acceso: F.acceso.value,
    medida: Number(F.medida.value), frenos: F.frenos.value, luces: F.luces.value, kit: k,
    autorizacion: { nombre: F.aut_nombre.value.trim(), motivo: F.aut_motivo.value.trim() }, observaciones: F.observaciones.value.trim(), foto };
}
function pintar(d, final) {
  const el = $("#c-dict"); el.className = "dict " + (d.resultado === "APTO" ? "APTO" : "NO");
  el.innerHTML = `<small>${final ? "Dictamen registrado" : "Dictamen"}</small><big>${d.resultado}</big><b>${esc(d.texto)}</b>` +
    (d.motivos.length ? `<small>${d.motivos.map(esc).join(" · ")}</small>` : "") + (d.bloqueante ? `<small>Bloqueante: no se puede autorizar.</small>` : "");
}
function actualizar() {
  const c = datos(); const listo = c.frenos && c.luces && Object.values(c.kit).every(Boolean);
  const falta = Object.values(c.kit).includes("Falta"), bloq = c.frenos === "NO" || c.luces === "NO";
  $("#c-aut").hidden = !(falta && !bloq && c.movimiento === "Salida a uso");
  if (bloq || listo) pintar(dictaminar(c)); else $("#c-dict").innerHTML = "";
}
F.tipo.onchange = () => { kit(); actualizar(); }; F.oninput = actualizar; F.onchange = actualizar;
$("#c-foto").onchange = (e) => { const f = e.target.files[0]; if (!f) return (foto = null);
  const img = new Image(); img.onload = () => { const c = document.createElement("canvas"), s = Math.min(1, 800 / Math.max(img.width, img.height));
    c.width = img.width * s; c.height = img.height * s; c.getContext("2d").drawImage(img, 0, 0, c.width, c.height); foto = c.toDataURL("image/jpeg", 0.6); }; img.src = URL.createObjectURL(f); };
F.onsubmit = async (e) => {
  e.preventDefault(); const c = datos(), err = [];
  if (!c.guardia) err.push("Elegí el guardia (cargalo en la semana)"); if (!c.unidad) err.push("Falta la unidad");
  if (!(c.medida >= 0) || F.medida.value === "") err.push("Cargá km u horas"); if (!c.frenos || !c.luces) err.push("Marcá frenos y luces");
  if (Object.values(c.kit).some((v) => !v)) err.push("Marcá todo el kit (Está / Falta)");
  $("#c-err").textContent = err.join(" · "); if (err.length) return;
  const [s, r] = await api("/api/chequeos", c);
  if (s === 201) { pintar(r.dictamen, true); $("#c-dict").scrollIntoView({ behavior: "smooth" }); } else $("#c-err").textContent = (r.errores || ["Error"]).join(" · ");
};
// ---------- Registros ----------
async function registros() {
  const [, ch] = await api("/api/chequeos"); await cargarSemana();
  $("#r-cheq").innerHTML = ch.length ? ch.slice(0, 20).map((c) => `<div class="reg ${c.dictamen.resultado === "APTO" ? "" : "NO"}"><b>${c.dictamen.resultado}</b> · ${esc(c.movimiento)} · ${esc(c.unidad)} (${esc(c.tipo)}) · ${esc(c.acceso)}<br>
    <small>${new Date(c.fecha).toLocaleString("es-AR")} · ${esc(c.guardia)}${c.dictamen.motivos.length ? " · " + c.dictamen.motivos.map(esc).join(", ") : ""}</small></div>`).join("") : "<p>Sin chequeos.</p>";
  $("#r-guard").innerHTML = semana ? semana.dias.map((d) => `<div class="reg"><b>${d.fecha.split("-").reverse().join("/")}</b><br>${d.guardias.map((g) => `${g.turno}: ${esc(g.nombre)} (${esc(g.empresa)}) · ${g.puesto}`).join("<br>")}</div>`).join("") : "<p>No hay semana cargada.</p>";
}
// ---------- Rutas ----------
function ruta() {
  const v = (location.hash || "#chequeo").slice(1);
  ["semana", "chequeo", "registros"].forEach((x) => ($("#v-" + x).hidden = x !== v));
  document.querySelectorAll("nav a").forEach((a) => a.classList.toggle("act", a.hash === "#" + v));
  if (v === "registros") registros();
}
addEventListener("hashchange", ruta);
$("#s-inicio").value = lunes(); kit();
cargarSemana().then(() => { if (semana) $("#s-inicio").value = semana.inicio; armarSemana(); ruta(); });
