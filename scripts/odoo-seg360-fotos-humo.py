#!/usr/bin/env python3
"""Seguridad 360 · fotos en el chequeo de portón + «¿Emite humo?» (x_seg360_chequeo). NO EJECUTADO: requiere OK de Jorge.
Por qué campos binarios y no ir.attachment suelto: en Odoo 19 crear un adjunto con res_model/res_id exige permiso de ESCRITURA sobre
el registro padre, y el usuario de servicio (grupo «Seguridad 360 / Servicio API») solo lee y crea chequeos (inmutables).
Un campo binario (attachment=True) se guarda como ir.attachment con res_field, creado con sudo dentro del create del chequeo: alcanza con «crear».
Crea (si no existe):
  x_humo «¿Emite humo?» selección si/no (Sí = NO APTO bloqueante; lo dictamina la app, R-S360-1 ya bloquea no_apto)
  x_foto_1..x_foto_4 «Foto 1..4» binario (adjunto) · x_fotos_cant «Fotos adjuntas» entero
  vista heredada del formulario: humo después de luces y una pestaña/grupo «Fotos» con widget imagen.
Modos: (sin args) SIMULACIÓN · --aplicar (backup JSON antes) · --rollback (borra vista y campos; BORRA las fotos y el dato de humo cargados).
Entorno: ODOO_URL, ODOO_DB, ODOO_UID (2), ODOO_API_KEY, BACKUP_JSON (default ./backup-fotos-humo-<fecha>.json)."""
import os, sys, json, datetime, xmlrpc.client
APLICAR, ROLLBACK = "--aplicar" in sys.argv, "--rollback" in sys.argv
U, D, UID, K = os.environ["ODOO_URL"], os.environ["ODOO_DB"], int(os.environ.get("ODOO_UID", "2")), os.environ["ODOO_API_KEY"]
m = xmlrpc.client.ServerProxy(U + "/xmlrpc/2/object", allow_none=True)
def c(mo, me, *a, **k): return m.execute_kw(D, UID, K, mo, me, list(a), k)
MODELO = "x_seg360_chequeo"
CAMPOS = {"x_humo": {"field_description": "¿Emite humo?", "ttype": "selection", "selection_ids": [(0, 0, {"value": "no", "name": "No", "sequence": 0}), (0, 0, {"value": "si", "name": "Sí", "sequence": 1})]},
          **{f"x_foto_{n}": {"field_description": f"Foto {n}", "ttype": "binary"} for n in range(1, 5)},
          "x_fotos_cant": {"field_description": "Fotos adjuntas", "ttype": "integer"}}
VISTA = "x_seg360_chequeo.form.seg360.fotos_humo"
ARCH = ('<data><xpath expr="//field[@name=\'x_luces\']" position="after"><field name="x_humo" decoration-danger="x_humo == \'si\'"/></xpath>'
        '<xpath expr="//sheet" position="inside"><group string="Fotos del chequeo" invisible="not x_fotos_cant"><field name="x_fotos_cant"/>'
        + "".join(f'<field name="x_foto_{n}" widget="image" options="{{\'size\': [240, 240]}}" invisible="not x_foto_{n}"/>' for n in range(1, 5)) + '</group></xpath></data>')

mid = c("ir.model", "search", [["model", "=", MODELO]])[0]
base = c("ir.ui.view", "search", [["model", "=", MODELO], ["type", "=", "form"], ["inherit_id", "=", False]])
existentes = {f["name"]: f["id"] for f in c("ir.model.fields", "search_read", [["model_id", "=", mid], ["name", "in", list(CAMPOS)]], fields=["name"])}
vista = c("ir.ui.view", "search", [["name", "=", VISTA]])
arch_base = c("ir.ui.view", "read", base[:1], fields=["arch_db"])[0]["arch_db"] if base else ""
print("modo:", "APLICAR" if APLICAR else "ROLLBACK" if ROLLBACK else "SIMULACIÓN", "· modelo", MODELO, mid, "· vista base", base,
      "· x_luces en vista:", "x_luces" in arch_base, "· <sheet>:", "<sheet" in arch_base, "· ya existen:", existentes, vista)

if ROLLBACK:
    if vista: print("borra vista", vista); c("ir.ui.view", "unlink", vista)
    if existentes: print("borra campos", existentes); c("ir.model.fields", "unlink", list(existentes.values()))
    sys.exit(0)
if APLICAR:
    ruta = os.environ.get("BACKUP_JSON") or f"backup-fotos-humo-{datetime.datetime.now():%Y%m%d-%H%M%S}.json"
    json.dump({"campos_modelo": c("ir.model.fields", "search_read", [["model_id", "=", mid]], fields=["name", "ttype", "field_description", "required"]),
               "vista_base": c("ir.ui.view", "read", base, fields=["name", "arch_db"]),
               "vistas_heredadas": c("ir.ui.view", "search_read", [["inherit_id", "in", base]], fields=["name", "arch_db"])}, open(ruta, "w"), ensure_ascii=False, indent=1)
    print("backup →", ruta)
for f, v in CAMPOS.items():
    if f in existentes: print("ya existe", f); continue
    print(("APLICA " if APLICAR else "HARÍA  ") + f"campo {f} ({v['ttype']}) «{v['field_description']}»")
    if APLICAR: c("ir.model.fields", "create", {"model_id": mid, "name": f, "state": "manual", "required": False, **v})
if not vista:
    print(("APLICA " if APLICAR else "HARÍA  ") + f"vista heredada {VISTA} sobre {base[:1]}: {ARCH}")
    if APLICAR: c("ir.ui.view", "create", {"name": VISTA, "model": MODELO, "inherit_id": base[0], "mode": "extension", "type": "form", "arch_db": ARCH})
print("listo" if APLICAR else "simulación: nada cambió. Aplicar con --aplicar")
