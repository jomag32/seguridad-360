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

// c = {movimiento, tipo, frenos:'OK'|'NO', luces, kit:{item:'Está'|'Falta'}, autorizacion:{nombre,motivo}}
export function dictaminar(c) {
  const motivos = [];
  if (c.frenos !== "OK") motivos.push("Frenos NO");
  if (c.luces !== "OK") motivos.push("Luces NO");
  if (motivos.length) return { resultado: "NO APTO", bloqueante: true, motivos, texto: "La unidad no sale" };
  const items = KIT[c.tipo] || [];
  const faltan = items.filter((i) => (c.kit || {})[i] !== "Está");
  if (!faltan.length) return { resultado: "APTO", bloqueante: false, motivos: [], texto: "Puede salir" };
  const m = faltan.map((i) => "Falta " + i);
  const a = c.autorizacion || {};
  const autorizado = !!(a.nombre && a.nombre.trim() && a.motivo && a.motivo.trim());
  if (c.movimiento === "Salida a uso" && autorizado)
    return { resultado: "APTO", bloqueante: false, motivos: m, autorizado: true,
      texto: `Sale con faltante autorizado por ${a.nombre.trim()} (${a.motivo.trim()})` };
  if (c.movimiento === "Salida a uso")
    return { resultado: "NO APTO", bloqueante: false, motivos: m, texto: "No sale salvo autorización (nombre y motivo)" };
  return { resultado: "NO APTO", bloqueante: false, motivos: m, texto: "Retorna con faltante: avisar a Mantenimiento" };
}

// Alta semanal: cada día 1 guardia de Día y 2 de Noche, con nombre y empresa.
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
    g.forEach((x) => { if (!x.nombre?.trim() || !x.empresa?.trim()) err.push(`${d.fecha} ${x.turno}: falta nombre o empresa`); });
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
  if (!l?.unidad?.trim()) e.push("Falta la unidad");
  if (!LLAVEROS[l?.color]) e.push("Elegí el color del llavero");
  if (!l?.entrego?.trim()) e.push("Falta quién entregó");
  if (!l?.guardia?.trim()) e.push("Elegí el guardia que recibe");
  if (!l?.fechaHora || isNaN(Date.parse(l.fechaHora))) e.push("Falta día y hora");
  if (l?.color === "AMARILLO" && !(l.restricciones || []).length && !l.otra?.trim()) e.push("Amarillo: marcá al menos una restricción");
  return e;
}
