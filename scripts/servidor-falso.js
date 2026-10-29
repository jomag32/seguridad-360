// Servidor local contra el Odoo falso en memoria (pruebas y capturas). Nunca toca Odoo real.
import http from "node:http"; import { crearApp } from "../server.js"; import { crearDatos } from "../datos-odoo.js"; import { odooFalso } from "../test/odoo-falso.js";
process.env.ACCESS_KEY ||= "PRUEBA7"; const o = odooFalso();
o.db["maintenance.request"].push({ id: 900, name: "MNT-900 · Ingreso · Falla en uso", equipment_id: 40, x_vehiculo_id: 5, x_causa: "falla_en_uso", x_sistema: "caja_transmision",
  description: "Ruido fuerte al pasar 2da", x_declaro: "Chofer de prueba", x_llegada: "por_sus_medios", x_guardia_id: 2, x_ok_guardia_fecha: "2026-10-29 14:10:00", x_km_horas_llegada: 1500, priority: "2", stage_id: 9, x_validacion: "pendiente" });
o.db["maintenance.request"].push({ id: 901, name: "MNT-901 · Ingreso · No apto en portón", equipment_id: 40, x_vehiculo_id: 5, x_causa: "no_apto_en_porton", x_sistema: "frenos",
  description: "Frenos NO", x_declaro: "Guardia (chequeo en portón)", x_llegada: "por_sus_medios", x_guardia_id: 1, x_ok_guardia_fecha: "2026-10-29 15:30:00", x_km_horas_llegada: 1400, priority: "3", stage_id: 9, x_validacion: "pendiente", x_fotos_pendientes: true });
http.createServer(crearApp(crearDatos(o.ejecutar))).listen(+process.env.PORT || 8361, () => console.log("Odoo FALSO en http://localhost:" + (process.env.PORT || 8361)));
