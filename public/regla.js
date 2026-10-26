// Regla APTO / NO APTO del chequeo visual en portón. Compartida por navegador y servidor.
export const TIPOS = ["Liviano", "Pesado", "Máquina", "Semirremolque"];
export const KIT = {
  "Liviano": ["Matafuego", "Balizas", "Gato", "Llave de rueda"],
  "Pesado": ["Matafuego", "Balizas", "Cuñas", "Llave de rueda"],
  "Máquina": ["Matafuego"],
  "Semirremolque": [],
};
export const ACCESOS = [
  ["A01", "A01 Peatonal (a relevar)"], ["A02", "A02 Portón Playa 1"], ["A03", "A03 Paso (a relevar)"],
  ["A04", "A04 Portón Taller"], ["A05", "A05"], ["A06", "A06"], ["A07", "A07"], ["A08", "A08"],
  ["A09", "A09"], ["A10", "A10"], ["A11", "A11"], ["A12", "A12"],
];
export const PUESTOS = [["S06", "Garita (S06)"], ...ACCESOS];

// c = {movimiento, tipo, frenos:'OK'|'NO', luces, vtv:'Sí'|'No', documentacion:'Sí'|'No', kit:{item:'Está'|'Falta'}}
// Frenos, luces, VTV/RTO y documentación son BLOQUEANTES: nunca se autorizan. Solo el faltante de kit lo puede autorizar el Jefe de Logística en Odoo.
export function dictaminar(c) {
  const motivos = [];
  if (c.frenos !== "OK") motivos.push("Frenos NO");
  if (c.luces !== "OK") motivos.push("Luces NO");
  if (c.tipo !== "Máquina" && c.vtv !== "Sí") motivos.push("VTV / RTO no vigente");
  if (c.documentacion !== "Sí") motivos.push("Documentación incompleta (cédula, seguro, VTV)");
  if (motivos.length) return { resultado: "NO APTO", bloqueante: true, motivos, texto: "La unidad no sale. No se puede autorizar (ni el Jefe de Logística)" };
  const items = KIT[c.tipo] || [];
  const faltan = items.filter((i) => (c.kit || {})[i] !== "Está");
  if (!faltan.length) return { resultado: "APTO", bloqueante: false, motivos: [], texto: "Puede salir" };
  const m = faltan.map((i) => "Falta " + i);
  // Sin autorización en la garita: la excepción la firma SOLO el Jefe de Logística en Odoo («Autorizar salida»).
  if (c.movimiento === "Salida a uso")
    return { resultado: "NO APTO", bloqueante: false, motivos: m, texto: "No sale: queda bloqueada hasta que el Jefe de Logística autorice la salida en Odoo" };
  return { resultado: "NO APTO", bloqueante: false, motivos: m, texto: "Retorna con faltante: queda bloqueada, avisar a Mantenimiento" };
}

// Alta semanal: cada día 1 guardia de Día y 2 de Noche, elegidos del maestro de guardias de Odoo.
export function validarSemana(s) {
  const err = [];
  if (!s || !s.inicio) err.push("Falta la fecha de inicio de semana");
  const dias = (s && s.dias) || [];
  if (dias.length !== 7) err.push("La semana debe tener 7 días");
  dias.forEach((d) => {
    const g = d.guardias || [];
    const dia = g.filter((x) => x.turno === "Día"), noche = g.filter((x) => x.turno === "Noche");
    if (dia.length !== 1) err.push(`${d.fecha}: tiene que haber 1 guardia de Día`);
    if (noche.length !== 2) err.push(`${d.fecha}: tiene que haber 2 guardias de Noche`);
    g.forEach((x) => { if (!x.guardiaId) err.push(`${d.fecha} ${x.turno}: elegí el guardia`); });
    const ids = g.map((x) => x.guardiaId).filter(Boolean); if (new Set(ids).size !== ids.length) err.push(`${d.fecha}: un guardia está repetido en el mismo día`);
  });
  return err;
}

// Devolución de llave (cierre del ciclo). Color que eligió Logística al cerrar.
export const LLAVEROS = {
  ROJO: "La unidad NO puede salir del taller. Si está en playa, no se puede mover.",
  AMARILLO: "Uso restringido: respetar las restricciones marcadas.",
  VERDE: "Uso libre.",
};
export const RESTRICCIONES = ["No salir a ruta", "No superar 60 km/h", "Controlar agua y aceite"];
export function validarLlave(l) {
  const e = [];
  if (!l?.vehiculoId && !l?.unidad?.trim()) e.push("Elegí la unidad (o escribila si no está en la lista)");
  if (!LLAVEROS[l?.color]) e.push("Elegí el color del llavero");
  if (!l?.entrego?.trim()) e.push("Falta quién entregó");
  if (!l?.guardiaId) e.push("Elegí el guardia que recibe");
  if (!l?.legajo?.trim() || !l?.dni?.trim()) e.push("Firma: cargá legajo y DNI del guardia");
  if (!l?.fechaHora || isNaN(Date.parse(l.fechaHora))) e.push("Falta día y hora");
  if (l?.color === "AMARILLO" && !(l.restricciones || []).length && !l.otra?.trim()) e.push("Amarillo: marcá al menos una restricción");
  return e;
}

// Chequeo: validación con mensajes claros (el formulario no usa «required» del navegador).
export function validarChequeo(c) {
  const e = [];
  if (!["Salida a uso", "Retorno de uso"].includes(c?.movimiento)) e.push("Elegí el movimiento (salida o retorno)");
  if (!c?.guardiaId) e.push("Elegí el guardia (si la lista está vacía, falta cargar la semana o el guardia en Odoo)");
  if (!c?.vehiculoId && !c?.unidad?.trim()) e.push("Elegí la unidad (o escribila si no está en la lista)");
  if (!TIPOS.includes(c?.tipo)) e.push("Elegí el tipo de unidad");
  if (!c?.portonId) e.push("Elegí el portón");
  if (c?.medida === "" || c?.medida == null || !(Number(c.medida) >= 0)) e.push("Cargá km u horas");
  if (!c?.frenos || !c?.luces) e.push("Marcá frenos y luces");
  if (c?.tipo !== "Máquina" && !["Sí", "No"].includes(c?.vtv)) e.push("Marcá si la VTV / RTO está vigente");
  if (!["Sí", "No"].includes(c?.documentacion)) e.push("Marcá si la documentación está completa");
  if (Object.values(c?.kit || {}).some((v) => !v) || (KIT[c?.tipo] || []).some((i) => !(c.kit || {})[i])) e.push("Marcá todo el kit (Está / Falta)");
  if (!c?.legajo?.trim() || !c?.dni?.trim()) e.push("Firma: cargá legajo y DNI del guardia");
  return e;
}
export const soloDigitos = (s) => String(s ?? "").replace(/\D/g, "");
export const normLegajo = (s) => String(s ?? "").trim().toUpperCase().replace(/\s+/g, "");
