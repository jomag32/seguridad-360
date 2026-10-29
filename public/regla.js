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
// Nivel de fluidos: solo en «Salida a uso». «Bajo el mínimo» es falla BLOQUEANTE (como frenos/luces): la unidad no sale y no se puede autorizar.
export const FLUIDOS = [["frenos", "Líquido de frenos"], ["refrigerante", "Refrigerante"], ["aceite", "Aceite de motor"]];
export const NIVELES = ["Bajo el mínimo", "Mínimo", "Medio", "Máximo"];
export const PUESTOS = [["S06", "Garita (S06)"], ...ACCESOS];

// c = {movimiento, tipo, frenos:'OK'|'NO', luces, vtv:'Sí'|'No', documentacion:'Sí'|'No', kit:{item:'Está'|'Falta'}}
// Frenos, luces, VTV/RTO, documentación y (en salida) fluido bajo el mínimo son BLOQUEANTES: nunca se autorizan. Solo el faltante de kit lo puede autorizar el Jefe de Logística en Odoo.
export function dictaminar(c) {
  const motivos = [];
  if (c.frenos !== "OK") motivos.push("Frenos NO");
  if (c.luces !== "OK") motivos.push("Luces NO");
  if (c.tipo !== "Máquina" && c.vtv !== "Sí") motivos.push("VTV / RTO no vigente");
  if (c.documentacion !== "Sí") motivos.push("Documentación incompleta (cédula, seguro, VTV)");
  if (c.movimiento === "Salida a uso") FLUIDOS.forEach(([k, t]) => { if ((c.fluidos || {})[k] === "Bajo el mínimo") motivos.push(t + " bajo el mínimo"); });
  if (motivos.length) return { resultado: "NO APTO", bloqueante: true, motivos, texto: "La unidad no sale. No se puede autorizar (ni el Jefe de Logística)" };
  const items = KIT[c.tipo] || [];
  const faltan = items.filter((i) => (c.kit || {})[i] !== "Está");
  if (!faltan.length) return c.movimiento === "Salida a uso" && c.estadoLogistica === "Apto con observación"
    ? { resultado: "APTO CON OBSERVACIÓN", bloqueante: false, motivos: [`Gravedad ${c.gravedad}: ${c.observacionFalla}`, `Ingreso previsto ${c.ingresoPrevisto}`], texto: "Puede salir con observación. Tiene que ingresar a mantenimiento antes de la fecha prevista" }
    : { resultado: "APTO", bloqueante: false, motivos: [], texto: "Puede salir" };
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
  if (c?.movimiento === "Salida a uso" && FLUIDOS.some(([k]) => !NIVELES.includes((c.fluidos || {})[k]))) e.push("Marcá el nivel de los 3 fluidos (frenos, refrigerante, aceite)");
  if (c?.movimiento === "Salida a uso" && c?.estadoLogistica === "Apto con observación") {
    if (!GRAVEDADES.includes(c.gravedad)) e.push("Apto con observación: elegí la gravedad de la falla");
    if (!c.observacionFalla?.trim()) e.push("Apto con observación: escribí la observación");
    if (!/^\d{4}-\d\d-\d\d$/.test(c.ingresoPrevisto || "")) e.push("Apto con observación: falta la fecha de ingreso previsto");
    if (!c.logistica?.trim()) e.push("Apto con observación: falta quién de Logística lo fijó");
  }
  if (!c?.legajo?.trim() || !c?.dni?.trim()) e.push("Firma: cargá legajo y DNI del guardia");
  return e;
}
export const soloDigitos = (s) => String(s ?? "").replace(/\D/g, "");
export const normLegajo = (s) => String(s ?? "").trim().toUpperCase().replace(/\s+/g, "");

// ---------- Etapa 1 · Playa disponible: Apto con observación (fuente: Control Flota 360°) ----------
export const ESTADOS_LOGISTICA = ["Apto", "Apto con observación"];
export const GRAVEDADES = ["Alta", "Media", "Baja"];
// PARÁMETROS EDITABLES (valores iniciales del documento, «para validar con el área»). En Odoo: ir.config_parameter seg360.plazo.<gravedad>.<tipo> (horas).
// Baja = «próximo service programado»: sin plazo automático, Logística carga la fecha.
export const PLAZOS_H = { Alta: { Liviano: 24, Pesado: 24, "Máquina": 24, Semirremolque: 24 }, Media: { Liviano: 72, Pesado: 48, "Máquina": 48, Semirremolque: 48 }, Baja: null };
/** fecha límite (AAAA-MM-DD, hora Argentina) = hoy + plazo según gravedad y tipo; null si no hay plazo automático. */
export function ingresoPrevisto(gravedad, tipo, hoy = new Date(), plazos = PLAZOS_H) {
  const h = plazos?.[gravedad]?.[tipo]; if (!h) return null;
  return new Date(hoy.getTime() - 3 * 3600e3 + h * 3600e3).toISOString().slice(0, 10);
}
// ---------- Etapa 1 · Ingreso a mantenimiento ----------
export const CAUSAS = ["Falla en uso", "No apto en portón", "Ingreso previsto vencido", "Daño o accidente", "Service por km u horas", "Vencimiento documental"];
export const SISTEMAS = ["Frenos", "Luces / eléctrico", "Motor", "Caja / transmisión", "Dirección / suspensión", "Neumáticos", "Refrigeración", "Hidráulico", "Carrocería", "Climatización", "Kit obligatorio", "Documentación", "Service preventivo", "Otro"];
export const LLEGADAS = ["Por sus medios", "Remolcada", "En grúa o carretón", "Quedó en la calle: la trae Logística"];
export const UBICACIONES = ["Taller propio", "Playa en espera", "En proveedor", "Varada en obra o ruta"]; // «En proveedor»: lógica en etapa 2
export const PRIORIDADES = [["Crítica (no sale)", "3"], ["Alta", "2"], ["Media", "1"], ["Baja", "0"]]; // estrellas de maintenance.request
export const FOTOS = [["tablero", "Tablero: km y testigos encendidos"], ["zona", "Zona de la falla"], ["frente", "Lado frente"], ["atras", "Lado atrás"], ["izq", "Lado izquierdo"], ["der", "Lado derecho"]];
export const fotosExigidas = (causa) => ["tablero", "zona", ...(causa === "Daño o accidente" ? ["frente", "atras", "izq", "der"] : [])];
/** i = {vehiculoId|unidad, causa, sistema, relato, llegada, guardiaId, legajo, dni, medida, prioridad, fotos:{clave:dataURL}}; ultimo = último km/horas registrado */
export function validarIngreso(i, ultimo = null) {
  const e = [];
  if (!i?.vehiculoId && !i?.unidad?.trim()) e.push("Elegí la unidad");
  if (!CAUSAS.includes(i?.causa)) e.push("Sin causa declarada no hay ingreso: elegí la causa");
  if (!SISTEMAS.includes(i?.sistema)) e.push("Elegí el sistema afectado");
  if (!i?.relato?.trim()) e.push("Falta el relato del chofer u operador");
  if (!i?.declaro?.trim()) e.push("Falta quién declaró la causa (chofer u operador)");
  if (!LLEGADAS.includes(i?.llegada)) e.push("Elegí cómo llega la unidad");
  if (!i?.guardiaId) e.push("Elegí el guardia que da el OK de llegada");
  if (i?.medida === "" || i?.medida == null || !(Number(i.medida) >= 0)) e.push("Cargá km u horas de llegada");
  else if (ultimo != null && Number(i.medida) < Number(ultimo)) e.push(`Km/horas de llegada (${i.medida}) menor que el último registro (${ultimo})`);
  if (!PRIORIDADES.some(([, v]) => v === i?.prioridad)) e.push("Elegí la gravedad (estrellas)");
  const f = i?.fotos || {}; const faltan = fotosExigidas(i?.causa).filter((k) => !/^data:image\//.test(f[k] || ""));
  if (faltan.length) e.push("Faltan fotos: " + faltan.map((k) => FOTOS.find(([x]) => x === k)[1]).join(", "));
  if (!i?.legajo?.trim() || !i?.dni?.trim()) e.push("Firma: cargá legajo y DNI del guardia");
  return e;
}
/** Fotos que completa el guardia después (pedidos creados por NO APTO en portón). */
export function validarFotos(f, causa) {
  const e = [], faltan = fotosExigidas(causa).filter((k) => !/^data:image\//.test((f?.fotos || {})[k] || ""));
  if (faltan.length) e.push("Faltan fotos: " + faltan.map((k) => FOTOS.find(([x]) => x === k)[1]).join(", "));
  if (!f?.guardiaId) e.push("Elegí el guardia");
  if (!f?.legajo?.trim() || !f?.dni?.trim()) e.push("Firma: cargá legajo y DNI del guardia");
  return e;
}
export function validarValidacion(v) {
  const e = [];
  if (typeof v?.valida !== "boolean") e.push("Elegí: valida la causa o no valida");
  if (!v?.por?.trim()) e.push("Falta quién de Logística valida");
  if (v?.valida === false && !v?.motivo?.trim()) e.push("No valida: escribí el motivo");
  if (v?.valida === true && !UBICACIONES.includes(v?.ubicacion)) e.push("Valida: elegí la ubicación");
  return e;
}
