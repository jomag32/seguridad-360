# seguridad-360 · Tecnología ARME · Visión 360 (piloto garita)
Web mobile-first, sin frameworks ni dependencias (Node 20). Un solo servicio sirve `public/` y guarda en `DATA_DIR/registros.json`. **Sin conexión a Odoo.**
Una sola garita (S06), en la manzana de la Fábrica; playas y taller cruzando la calle (accesos A01–A12 según el croquis).

- `npm start` → http://localhost:8360 (`PORT`, `DATA_DIR` opcionales)
- `npm test` → reglas APTO / NO APTO y validación de la semana
- Vistas: `#semana` (alta semanal), `#chequeo` (portón), `#registros` (+ CSV en `/api/export/chequeos.csv` y `/api/export/guardias.csv`)
- Capturas: `node test/capturas.mjs` (necesita `playwright-core` y Chrome) → `capturas/`

## Regla
- Frenos o luces = NO → **NO APTO · "La unidad no sale"**. Bloqueante, sin override.
- Falta un ítem del kit en *Salida a uso* → NO APTO, salvo autorización con nombre **y** motivo (queda registrada).
- Falta kit en *Retorno de uso* → NO APTO (aviso a Mantenimiento).
- El servidor recalcula el dictamen; no confía en el cliente.

## Render
`render.yaml` listo (plan free, NO desplegado). En free el disco es efímero: los datos se pierden en cada redeploy/reinicio.
