# Seguridad 360 · app de garita (Tecnología ARME)
Web mobile-first, sin frameworks ni dependencias (Node 20). Es solo el **frente para el teléfono** de los guardias de terceros (sin usuario de Odoo):
todo se lee y se guarda en **Odoo** (menú *Seguridad 360*, modelos `x_seg360_*`) con un usuario de servicio.

- Env (Render): `ACCESS_KEY`, `ODOO_URL`, `ODOO_DB`, `ODOO_USER`, `ODOO_PASSWORD` (clave API del usuario de servicio). Nunca van al código ni a los logs.
- Clave de acceso: la pantalla de ingreso la pide una vez y la guarda en el teléfono; la API y los CSV la exigen (header `x-access-key`).
- Guardias, portones y unidades salen de Odoo. El guardia **firma con legajo + DNI** (se verifica contra el maestro; el DNI no se copia al registro).
- Sin foto. `npm test` usa un Odoo falso en memoria (`test/odoo-falso.js`).
- Vistas: `#semana` (alta semanal), `#chequeo` (portón), `#llave` (devolución de llave), `#registros` (+ CSV `/api/export/{chequeos,guardias,llaves}.csv`).

## Reglas (se aplican en Odoo, no solo en la app)
- Frenos NO, luces NO, VTV/RTO no vigente o documentación incompleta → **NO APTO bloqueante**: no se autoriza nunca.
- Falta kit → NO APTO y la unidad queda **No apto – bloqueado**. Solo sale si el grupo *Seguridad 360 / Autoriza salida* (Jefe de Logística)
  presiona «Autorizar salida» en Odoo con motivo (texto libre). La app muestra «Salida autorizada por … – motivo».
- Una unidad bloqueada no puede registrar otra «Salida a uso» hasta autorización o liberación por un Responsable.
- Llavero ROJO bloquea la «Salida a uso» de esa unidad hasta una devolución VERDE o AMARILLO posterior o liberación de un Responsable.

## Odoo
`scripts/odoo-crear-seg360.py`, `-portones.py`, `-autoriza.py`: simulación por defecto, `--aplicar` para crear. Usuarios por argumento (no se guardan acá).
