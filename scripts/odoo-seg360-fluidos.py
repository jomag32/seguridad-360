#!/usr/bin/env python3
"""Seguridad 360 · nivel de fluidos en «Salida a uso» (x_seg360_chequeo). NO EJECUTADO todavía: requiere OK de Jorge.
Agrega 3 campos selección (no obligatorios en Odoo: el retorno no los carga; la app los exige en salida):
  x_nivel_liq_frenos «Nivel líquido de frenos», x_nivel_refrigerante «Nivel refrigerante», x_nivel_aceite «Nivel aceite de motor»
  valores: bajo=Bajo el mínimo · minimo=Mínimo · medio=Medio · maximo=Máximo
y una vista heredada del formulario (grupo «Nivel de fluidos (salida)», visible solo si x_movimiento = salida).
No cambia reglas: «bajo el mínimo» llega como x_dictamen=no_apto + x_bloqueante=True, que la regla R-S360-1 ya bloquea
y el botón «Autorizar salida» ya no ofrece (x_bloqueante).
Modos: (sin args) SIMULACIÓN · --aplicar (hace backup JSON antes) · --rollback (borra vista y campos creados por este script; BORRA los niveles cargados).
Entorno: ODOO_URL, ODOO_DB, ODOO_UID (2), ODOO_API_KEY, BACKUP_JSON (default ./backup-fluidos-<fecha>.json)."""
import os, sys, json, datetime, xmlrpc.client
APLICAR, ROLLBACK = "--aplicar" in sys.argv, "--rollback" in sys.argv
U, D, UID, K = os.environ["ODOO_URL"], os.environ["ODOO_DB"], int(os.environ.get("ODOO_UID", "2")), os.environ["ODOO_API_KEY"]
m = xmlrpc.client.ServerProxy(U + "/xmlrpc/2/object", allow_none=True)
def c(mo, me, *a, **k): return m.execute_kw(D, UID, K, mo, me, list(a), k)
MODELO = "x_seg360_chequeo"
NIV = [("bajo", "Bajo el mínimo"), ("minimo", "Mínimo"), ("medio", "Medio"), ("maximo", "Máximo")]
CAMPOS = {"x_nivel_liq_frenos": "Nivel líquido de frenos", "x_nivel_refrigerante": "Nivel refrigerante", "x_nivel_aceite": "Nivel aceite de motor"}
VISTA = "x_seg360_chequeo.form.seg360.fluidos"
ARCH = ('<data><xpath expr="//field[@name=\'x_documentacion\']/.." position="after">'
        '<group string="Nivel de fluidos (salida)" invisible="x_movimiento != \'salida\'">'
        + "".join(f'<field name="{f}" decoration-danger="{f} == \'bajo\'"/>' for f in CAMPOS) + '</group></xpath></data>')

mid = c("ir.model", "search", [["model", "=", MODELO]])[0]
base = c("ir.ui.view", "search", [["model", "=", MODELO], ["type", "=", "form"], ["inherit_id", "=", False], ["name", "=", "x_seg360_chequeo.form.seg360"]])
existentes = {f["name"]: f["id"] for f in c("ir.model.fields", "search_read", [["model_id", "=", mid], ["name", "in", list(CAMPOS)]], fields=["name"])}
vista = c("ir.ui.view", "search", [["name", "=", VISTA]])
print("modo:", "APLICAR" if APLICAR else "ROLLBACK" if ROLLBACK else "SIMULACIÓN", "· modelo", MODELO, mid, "· vista base", base, "· ya existen:", existentes, vista)

if ROLLBACK:
    if vista: print("borra vista", vista); c("ir.ui.view", "unlink", vista)
    if existentes: print("borra campos", existentes); c("ir.model.fields", "unlink", list(existentes.values()))
    sys.exit(0)

if APLICAR:
    ruta = os.environ.get("BACKUP_JSON") or f"backup-fluidos-{datetime.datetime.now():%Y%m%d-%H%M%S}.json"
    json.dump({"campos_modelo": c("ir.model.fields", "search_read", [["model_id", "=", mid]], fields=["name", "ttype", "field_description", "required"]),
               "vista_base": c("ir.ui.view", "read", base, fields=["name", "arch_db"]),
               "vistas_heredadas": c("ir.ui.view", "search_read", [["inherit_id", "in", base]], fields=["name", "arch_db"])},
              open(ruta, "w"), ensure_ascii=False, indent=1)
    print("backup →", ruta)

for f, etq in CAMPOS.items():
    if f in existentes: print("ya existe", f); continue
    print(("APLICA " if APLICAR else "HARÍA  ") + f"campo {f} selección {NIV}")
    if APLICAR: c("ir.model.fields", "create", {"model_id": mid, "name": f, "field_description": etq, "ttype": "selection", "required": False, "state": "manual",
        "selection_ids": [(0, 0, {"value": v, "name": n, "sequence": i}) for i, (v, n) in enumerate(NIV)]})
if not vista:
    print(("APLICA " if APLICAR else "HARÍA  ") + f"vista heredada {VISTA} sobre {base}: {ARCH}")
    if APLICAR: c("ir.ui.view", "create", {"name": VISTA, "model": MODELO, "inherit_id": base[0], "mode": "extension", "type": "form", "arch_db": ARCH})
print("listo" if APLICAR else "simulación: nada cambió. Aplicar con --aplicar")
