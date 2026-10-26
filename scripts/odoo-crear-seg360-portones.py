#!/usr/bin/env python3
"""Seguridad 360 · maestro de Portones (x_seg360_porton) precargado del croquis (A01–A12) y x_porton_id en el chequeo de portón.
SIMULACIÓN por defecto; --aplicar. Entorno: ODOO_URL, ODOO_DB, ODOO_UID, ODOO_API_KEY."""
import os, sys, xmlrpc.client
APLICAR = "--aplicar" in sys.argv
U, D, UID, K = os.environ["ODOO_URL"], os.environ["ODOO_DB"], int(os.environ.get("ODOO_UID", "2")), os.environ["ODOO_API_KEY"]
m = xmlrpc.client.ServerProxy(U + "/xmlrpc/2/object", allow_none=True)
def c(mo, me, *a, **k): return m.execute_kw(D, UID, K, mo, me, list(a), k)
def hacer(que, fn):
    print(("APLICA " if APLICAR else "HARÍA  ") + que); return fn() if APLICAR else None
def S(etq, *p): return {"ttype": "selection", "field_description": etq, "selection_ids": [(0, 0, {"value": v, "name": n, "sequence": i}) for i, (v, n) in enumerate(p)]}
CAMPOS = {"x_codigo": {"ttype": "char", "field_description": "Código", "required": True},
  "x_bloque": S("Ubicación / bloque", ("fabrica","Fábrica"),("playa1","Playa 1"),("playa2","Playa 2"),("taller","Taller")),
  "x_tipo": S("Tipo", ("peatonal","Peatonal"),("vehiculos","Vehículos"),("ambos","Ambos")),
  "x_garita": S("Garita asociada", ("S06","S06 · Garita"),("ninguna","Ninguna")),
  "x_tiene_guardia": {"ttype": "boolean", "field_description": "Tiene guardia"}, "x_active": {"ttype": "boolean", "field_description": "Activo"},
  "x_observaciones": {"ttype": "text", "field_description": "Observaciones"}}
R = "Croquis del paquete 05: "
DATOS = [("A01","Puerta peatonal","playa1","peatonal","ninguna",R+"única puerta peatonal del predio; ubicación exacta a relevar."),
 ("A02","Portón Playa 1","playa1","vehiculos","ninguna",R+"acceso de playa; el guardia cruza desde la garita al aviso de Logística."),
 ("A03","Pasaje entre Playa 1 y Playa 2","playa2","ambos","ninguna",R+"interno; a confirmar si es portón o paso abierto."),
 ("A04","Portón del Taller","taller","vehiculos","ninguna",R+"sin guardia fijo, lo maneja Logística.")] + \
 [(f"A{i+4:02d}", f"Portón de Fábrica {i}", "fabrica", "vehiculos", "S06", R+"manzana de Fábrica, junto a la garita S06; nombre y ubicación a relevar.") for i in range(1, 9)]
x = lambda mo, n: c("ir.model.fields", "search", [["model", "=", mo], ["name", "=", n]])
mid = c("ir.model", "search", [["model", "=", "x_seg360_porton"]])
mid = mid[0] if mid else hacer("modelo x_seg360_porton", lambda: c("ir.model", "create", {"model": "x_seg360_porton", "name": "Seguridad 360 · Portón", "state": "manual",
    "is_mail_thread": True, "field_id": [(0, 0, {"name": "x_name", "ttype": "char", "field_description": "Nombre", "required": True})] + [(0, 0, {"name": n, **v}) for n, v in CAMPOS.items()]}))
if APLICAR and not c("ir.default", "search", [["field_id", "in", x("x_seg360_porton", "x_active")]]):
    c("ir.default", "create", {"field_id": x("x_seg360_porton", "x_active")[0], "json_value": "true"})
G = {n: c("res.groups", "search", [["name", "=", n]])[0] for n in ["Seguridad 360 / Lectura", "Seguridad 360 / Responsable", "Seguridad 360 / Servicio API"]}
for g, p in [(G["Seguridad 360 / Lectura"], (1,0,0,0)), (G["Seguridad 360 / Responsable"], (1,1,1,0)), (G["Seguridad 360 / Servicio API"], (1,0,0,0)), (216, (1,1,1,1))]:
    if not APLICAR or not c("ir.model.access", "search", [["model_id", "=", mid], ["group_id", "=", g]]):
        hacer(f"acceso portón grupo {g} {p}", lambda: c("ir.model.access", "create", {"name": f"x_seg360_porton_g{g}", "model_id": mid, "group_id": g,
            "perm_read": bool(p[0]), "perm_write": bool(p[1]), "perm_create": bool(p[2]), "perm_unlink": bool(p[3])}))
for cod, nom, b, t, ga, obs in DATOS:
    if not APLICAR or not c("x_seg360_porton", "search", [["x_codigo", "=", cod], "|", ["x_active", "=", True], ["x_active", "=", False]]):
        hacer(f"portón {cod} {nom}", lambda: c("x_seg360_porton", "create", {"x_codigo": cod, "x_name": f"{cod} · {nom}", "x_bloque": b, "x_tipo": t, "x_garita": ga,
            "x_tiene_guardia": False, "x_active": True, "x_observaciones": obs}))
VISTAS = [("list", '<list><field name="x_codigo"/><field name="x_name"/><field name="x_bloque"/><field name="x_tipo"/><field name="x_garita"/><field name="x_tiene_guardia"/><field name="x_active"/></list>'),
 ("form", '<form><sheet><widget name="web_ribbon" title="Archivado" bg_color="text-bg-danger" invisible="x_active"/><h1><field name="x_name"/></h1><group><group><field name="x_codigo"/><field name="x_bloque"/><field name="x_tipo"/></group>'
          '<group><field name="x_garita"/><field name="x_tiene_guardia"/><field name="x_active"/></group></group><group><field name="x_observaciones"/></group></sheet><chatter/></form>')]
for t, arch in VISTAS:
    if not c("ir.ui.view", "search", [["model", "=", "x_seg360_porton"], ["type", "=", t]]):
        hacer(f"vista {t} portón", lambda: c("ir.ui.view", "create", {"name": f"x_seg360_porton.{t}.seg360", "model": "x_seg360_porton", "type": t, "arch": arch}))
acc = c("ir.actions.act_window", "search", [["res_model", "=", "x_seg360_porton"]])
acc = acc[0] if acc else hacer("acción Portones", lambda: c("ir.actions.act_window", "create", {"name": "Portones", "res_model": "x_seg360_porton", "view_mode": "list,form"}))
raiz = c("ir.ui.menu", "search", [["name", "=", "Seguridad 360"], ["parent_id", "=", False]])[0]
men = c("ir.ui.menu", "search", [["name", "=", "Portones"], ["parent_id", "=", raiz]])
men = men[0] if men else hacer("menú Portones", lambda: c("ir.ui.menu", "create", {"name": "Portones", "parent_id": raiz, "action": f"ir.actions.act_window,{acc}", "sequence": 6}))
# chequeo → portón
ch = c("ir.model", "search", [["model", "=", "x_seg360_chequeo"]])[0]
if not x("x_seg360_chequeo", "x_porton_id"):
    hacer("campo x_seg360_chequeo.x_porton_id", lambda: c("ir.model.fields", "create", {"model_id": ch, "name": "x_porton_id", "ttype": "many2one", "relation": "x_seg360_porton",
        "field_description": "Portón", "on_delete": "restrict"}))
    hacer("campo x_acceso → «Acceso (texto, histórico)»", lambda: c("ir.model.fields", "write", x("x_seg360_chequeo", "x_acceso"), {"field_description": "Acceso (texto, histórico)"}))
for t in ("list", "form"):
    v = c("ir.ui.view", "search_read", [["name", "=", f"x_seg360_chequeo.{t}.seg360"]], fields=["arch_db"])[0]
    if "x_porton_id" not in v["arch_db"]:
        nuevo = v["arch_db"].replace('<field name="x_acceso"/>', '<field name="x_porton_id"/>')
        hacer(f"vista {t} chequeo: x_acceso → x_porton_id", lambda: c("ir.ui.view", "write", [v["id"]], {"arch_db": nuevo}))
print("IDs:", {"modelo": mid, "accion": acc, "menu": men, "portones": c("x_seg360_porton", "search_read", [], fields=["x_codigo"]) if APLICAR else None})
