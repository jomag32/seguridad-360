#!/usr/bin/env python3
"""Seguridad 360 · excepción NO APTO: «Salida autorizada» solo por el grupo «Seguridad 360 / Autoriza salida» (Jefe de Logística).
Agrega estado salida_autorizada, campos de autorización, botón «Autorizar salida» (acción servidor con chequeo de grupo) y
automatización al escribir que rechaza el pase a «Salida autorizada» de cualquier usuario fuera del grupo.
SIMULACIÓN por defecto; --aplicar. --autoriza=<uid> (no se guarda en el repo). Entorno: ODOO_URL, ODOO_DB, ODOO_UID, ODOO_API_KEY."""
import os, sys, xmlrpc.client
APLICAR = "--aplicar" in sys.argv
AUT = [int(a.split("=")[1]) for a in sys.argv if a.startswith("--autoriza=")]
U, D, UID, K = os.environ["ODOO_URL"], os.environ["ODOO_DB"], int(os.environ.get("ODOO_UID", "2")), os.environ["ODOO_API_KEY"]
m = xmlrpc.client.ServerProxy(U + "/xmlrpc/2/object", allow_none=True)
def c(mo, me, *a, **k): return m.execute_kw(D, UID, K, mo, me, list(a), k)
def hacer(que, fn):
    print(("APLICA " if APLICAR else "HARÍA  ") + que); return fn() if APLICAR else None
MO = "x_seg360_chequeo"; XID = "__export__.seg360_autoriza_salida"
mid = c("ir.model", "search", [["model", "=", MO]])[0]
fld = lambda n: c("ir.model.fields", "search", [["model", "=", MO], ["name", "=", n]])
g = c("res.groups", "search", [["name", "=", "Seguridad 360 / Autoriza salida"]])
g = g[0] if g else hacer("grupo «Seguridad 360 / Autoriza salida»", lambda: c("res.groups", "create", {"name": "Seguridad 360 / Autoriza salida",
    "comment": "ÚNICO autorizante de salida de una unidad NO APTO: Jefe de Logística. No sumar a nadie más sin decisión del COO."}))
if AUT: hacer(f"usuarios {AUT} → Autoriza salida (reemplaza)", lambda: c("res.groups", "write", [g], {"user_ids": [(6, 0, AUT)]}))
if APLICAR and not c("ir.model.data", "search", [["module", "=", "__export__"], ["name", "=", "seg360_autoriza_salida"]]):
    c("ir.model.data", "create", {"module": "__export__", "name": "seg360_autoriza_salida", "model": "res.groups", "res_id": g})
for lect in ["Seguridad 360 / Lectura"]:
    gl = c("res.groups", "search", [["name", "=", lect]])[0]
    if APLICAR and not c("ir.model.access", "search", [["model_id", "=", mid], ["group_id", "=", g]]):
        c("ir.model.access", "create", {"name": f"{MO}_g{g}", "model_id": mid, "group_id": g, "perm_read": True, "perm_write": True, "perm_create": False, "perm_unlink": False})
est = fld("x_estado")[0]
if not c("ir.model.fields.selection", "search", [["field_id", "=", est], ["value", "=", "salida_autorizada"]]):
    hacer("estado «Salida autorizada»", lambda: c("ir.model.fields.selection", "create", {"field_id": est, "value": "salida_autorizada", "name": "Salida autorizada", "sequence": 2}))
hacer("etiqueta «Bloqueada (NO APTO)» → «No apto – bloqueado»", lambda: c("ir.model.fields.selection", "write",
    c("ir.model.fields.selection", "search", [["field_id", "=", est], ["value", "=", "bloqueada"]]), {"name": "No apto – bloqueado", "sequence": 1}))
NUEVOS = {"x_aut_salida_por_id": {"ttype": "many2one", "relation": "res.users", "field_description": "Salida autorizada por",
            "domain": f"[('group_ids', 'in', [{g or 0}])]"},
          "x_aut_salida_motivo": {"ttype": "char", "field_description": "Motivo de la autorización de salida"},
          "x_aut_salida_fecha": {"ttype": "datetime", "field_description": "Salida autorizada el"},
          "x_vtv_vigente": {"ttype": "selection", "field_description": "VTV / RTO vigente", "selection_ids": [(0, 0, {"value": v, "name": t, "sequence": i}) for i, (v, t) in enumerate([("si", "Sí"), ("no", "No"), ("na", "No aplica")])]},
          "x_documentacion": {"ttype": "selection", "field_description": "Documentación completa (cédula, seguro, VTV)", "selection_ids": [(0, 0, {"value": v, "name": t, "sequence": i}) for i, (v, t) in enumerate([("si", "Sí"), ("no", "No")])]}}
for n, v in NUEVOS.items():
    if not fld(n): hacer(f"campo {n}", lambda: c("ir.model.fields", "create", {"model_id": mid, "name": n, **v}))
CODIGO_BOTON = """# Seguridad 360 · Autorizar salida de unidad NO APTO (solo grupo «Seguridad 360 / Autoriza salida»).
if not env.user.has_group('%s'):
    raise UserError('Solo el Jefe de Logística (grupo «Seguridad 360 / Autoriza salida») puede autorizar la salida de una unidad NO APTO.')
for r in records:
    if r.x_estado != 'bloqueada' or r.x_movimiento != 'salida':
        raise UserError('%%s: solo se autoriza un chequeo de «Salida a uso» en estado «No apto – bloqueado».' %% r.x_name)
    if r.x_bloqueante or r.x_frenos == 'no' or r.x_luces == 'no' or r.x_vtv_vigente == 'no' or r.x_documentacion == 'no':
        raise UserError('Falla bloqueante (frenos, luces, VTV/RTO o documentación): la salida no se puede autorizar, ni siquiera el Jefe de Logística. Solo se autoriza faltante de kit.')
    if not (r.x_aut_salida_motivo or '').strip():
        raise UserError('Cargá el «Motivo de la autorización de salida» antes de autorizar.')
    r.write({'x_estado': 'salida_autorizada', 'x_aut_salida_por_id': env.user.id, 'x_aut_salida_fecha': datetime.datetime.now()})
    r.message_post(body='Salida autorizada por %%s: %%s' %% (env.user.name, r.x_aut_salida_motivo))
""" % XID
CODIGO_GUARDA = """# Seguridad 360 · R-S360-2: nadie fuera de «Seguridad 360 / Autoriza salida» puede dejar un chequeo en «Salida autorizada»
# ni tocar quién/cuándo/por qué se autorizó (control en servidor, no solo en pantalla). Exige motivo.
for r in records:
    if r.x_estado == 'salida_autorizada':
        if not env.user.has_group('%s'):
            raise UserError('Solo el Jefe de Logística puede autorizar la salida de una unidad NO APTO.')
        if r.x_bloqueante or r.x_frenos == 'no' or r.x_luces == 'no' or r.x_vtv_vigente == 'no' or r.x_documentacion == 'no':
            raise UserError('Falla bloqueante (frenos, luces, VTV/RTO o documentación): la salida no se puede autorizar, ni siquiera el Jefe de Logística. Solo se autoriza faltante de kit.')
        if not (r.x_aut_salida_motivo or '').strip():
            raise UserError('La salida autorizada requiere motivo.')
        if r.x_aut_salida_por_id and r.x_aut_salida_por_id != env.user:
            raise UserError('El autorizante registrado tiene que ser quien autoriza.')
""" % XID
b = c("ir.actions.server", "search", [["name", "=", "Seguridad 360 · Autorizar salida"]])
b = b[0] if b else hacer("acción servidor Autorizar salida", lambda: c("ir.actions.server", "create", {"name": "Seguridad 360 · Autorizar salida", "model_id": mid,
    "state": "code", "group_ids": [(6, 0, [g])], "code": CODIGO_BOTON}))
nom = "Seguridad 360 · R-S360-2 solo Autoriza salida pasa a «Salida autorizada»"
if not c("base.automation", "search", [["name", "=", nom]]):
    def auto():
        a = c("ir.actions.server", "create", {"name": nom + " (código)", "model_id": mid, "state": "code", "usage": "base_automation", "code": CODIGO_GUARDA})
        return c("base.automation", "create", {"name": nom, "model_id": mid, "trigger": "on_create_or_write",
            "trigger_field_ids": [(6, 0, fld("x_estado") + fld("x_aut_salida_por_id") + fld("x_aut_salida_motivo") + fld("x_aut_salida_fecha"))], "action_server_ids": [(6, 0, [a])]})
    hacer(f"automatización {nom}", auto)
v = c("ir.ui.view", "search_read", [["name", "=", f"{MO}.form.seg360"]], fields=["arch_db"])[0]
if "x_aut_salida_motivo" not in v["arch_db"]:
    a = v["arch_db"]
    a = a.replace('<field name="x_estado" widget="statusbar"/>',
        f'<button name="{b or 0}" type="action" string="Autorizar salida" class="btn-danger" invisible="x_estado != \'bloqueada\' or x_movimiento != \'salida\' or x_bloqueante or x_frenos == \'no\' or x_luces == \'no\' or x_vtv_vigente == \'no\' or x_documentacion == \'no\'" groups="{XID}"/>'
        '<field name="x_estado" widget="statusbar" statusbar_visible="habilitada,bloqueada,salida_autorizada,liberada"/>')
    a = a.replace('<group string="Liberación"', '<group string="Autorización de salida (solo Jefe de Logística)" invisible="x_estado not in (\'bloqueada\', \'salida_autorizada\') or x_movimiento != \'salida\'">'
        '<field name="x_aut_salida_motivo" placeholder="Texto libre. Ej.: Faltante revisado · Salida con faltante autorizada · Reposición en destino" readonly="x_estado != \'bloqueada\'" required="x_estado == \'salida_autorizada\'"/><field name="x_aut_salida_por_id" readonly="1"/><field name="x_aut_salida_fecha" readonly="1"/></group><group string="Liberación"')
    hacer("vista form chequeo: botón + bloque autorización", lambda: c("ir.ui.view", "write", [v["id"]], {"arch_db": a}))
print("IDs:", {"grupo": g, "boton": b, "automatizacion": c("base.automation", "search", [["name", "=", nom]])})
