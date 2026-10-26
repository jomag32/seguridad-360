#!/usr/bin/env python3
"""Seguridad 360 en Odoo (ARME). Crea, si no existen: modelos x_seg360_* (guardias, semana, turno, chequeo de portón, devolución de llave),
grupos «Seguridad 360 / Lectura|Responsable|Servicio API», accesos, secuencias + numeración, regla de bloqueo NO APTO, vistas lista/form/búsqueda,
acciones, botón «Liberar unidad» y menú raíz «Seguridad 360». No toca modelos ni menús x_hys_*.
Por defecto SIMULACIÓN. Aplicar: --aplicar. Entorno: ODOO_URL, ODOO_DB, ODOO_UID, ODOO_API_KEY, BACKUP_JSON (opcional).
Usuarios: --lector=<uid> (repetible), --responsable=<uid>, --api=<uid> (no se guardan en el repo)."""
import os, sys, json, xmlrpc.client
APLICAR = "--aplicar" in sys.argv
arg = lambda p: [int(a.split("=")[1]) for a in sys.argv if a.startswith(p + "=")]
LECT, RESP, API = arg("--lector"), arg("--responsable"), arg("--api")
U, D, UID, K = os.environ["ODOO_URL"], os.environ["ODOO_DB"], int(os.environ.get("ODOO_UID", "2")), os.environ["ODOO_API_KEY"]
m = xmlrpc.client.ServerProxy(U + "/xmlrpc/2/object", allow_none=True)
def c(mo, me, *a, **k): return m.execute_kw(D, UID, K, mo, me, list(a), k)
CREADO = {}
def hacer(que, fn):
    print(("APLICA " if APLICAR else "HARÍA  ") + que)
    if APLICAR:
        r = fn(); CREADO.setdefault(que.split(" ")[0], []).append(r); return r
G_DESA = 216
def S(etq, *p, req=False): return {"ttype": "selection", "field_description": etq, "required": req,
    "selection_ids": [(0, 0, {"value": v, "name": n, "sequence": i}) for i, (v, n) in enumerate(p)]}
def F(etq, t, rel=None, req=False, **kw): return {"ttype": t, "field_description": etq, "required": req, **({"relation": rel} if rel else {}), **kw}
TIPO = S("Tipo de unidad", ("liviano","Liviano"),("pesado","Pesado"),("maquina","Máquina"),("semirremolque","Semirremolque"), req=True)
FIRMA = {"x_firma_legajo": F("Firma: legajo del guardia", "char"), "x_firma_verificada": F("Firma verificada (legajo + DNI)", "boolean"),
         "x_firma_fecha": F("Firmado el", "datetime"), "x_clave_envio": F("Clave de envío", "char", index="btree")}
MODELOS = [
 ("x_seg360_guardia", "Seguridad 360 · Guardia", "Nombre y apellido", {
  "x_legajo": F("Legajo en la empresa de seguridad", "char", req=True), "x_dni": F("DNI", "char", req=True),
  "x_empresa": F("Empresa de seguridad", "char", req=True), "x_active": F("Activo", "boolean")}),
 ("x_seg360_semana", "Seguridad 360 · Semana de guardias", "Número", {
  "x_inicio": F("Semana (lunes)", "date", req=True), "x_garita": F("Garita", "char"), "x_observaciones": F("Observaciones", "text")}),
 ("x_seg360_turno", "Seguridad 360 · Turno de guardia", "Turno", {
  "x_semana_id": F("Semana", "many2one", "x_seg360_semana", req=True, on_delete="cascade"), "x_fecha": F("Fecha", "date", req=True),
  "x_turno": S("Turno", ("dia","Día"),("noche","Noche"), req=True), "x_guardia_id": F("Guardia", "many2one", "x_seg360_guardia", req=True, on_delete="restrict"),
  "x_puesto": F("Puesto", "char")}),
 ("x_seg360_chequeo", "Seguridad 360 · Chequeo en portón", "Número", {
  "x_fecha_hora": F("Fecha y hora", "datetime", req=True), "x_movimiento": S("Movimiento", ("salida","Salida a uso"),("retorno","Retorno de uso"), req=True),
  "x_guardia_id": F("Guardia", "many2one", "x_seg360_guardia", req=True, on_delete="restrict"),
  "x_vehiculo_id": F("Unidad", "many2one", "fleet.vehicle"), "x_unidad_texto": F("Unidad (si no está en Flota)", "char"),
  "x_tipo": TIPO, "x_acceso": F("Acceso", "char"), "x_km_horas": F("Km u horas", "float"),
  "x_frenos": S("Frenos", ("ok","OK"),("no","NO"), req=True), "x_luces": S("Luces", ("ok","OK"),("no","NO"), req=True),
  "x_kit": F("Kit (ítem: Está/Falta)", "text"),
  "x_vtv_vigente": S("VTV / RTO vigente", ("si","Sí"),("no","No"),("na","No aplica")), "x_documentacion": S("Documentación completa (cédula, seguro, VTV)", ("si","Sí"),("no","No")),
  "x_dictamen": S("Dictamen", ("apto","APTO"),("no_apto","NO APTO"), req=True), "x_motivos": F("Motivos", "text"),
  "x_bloqueante": F("Falla bloqueante (frenos o luces)", "boolean"),
  "x_estado": S("Estado de la unidad", ("habilitada","Habilitada"),("bloqueada","Bloqueada (NO APTO)"),("liberada","Liberada"), req=True),
  "x_autoriza": F("Autoriza faltante (nombre)", "char"), "x_motivo_autorizacion": F("Motivo de la autorización", "char"),
  "x_observaciones": F("Observaciones", "text"),
  "x_liberado_por_id": F("Liberada por", "many2one", "res.users"), "x_liberado_el": F("Liberada el", "datetime"),
  "x_motivo_liberacion": F("Motivo de la liberación", "char"), **FIRMA}),
 ("x_seg360_llave", "Seguridad 360 · Devolución de llave", "Número", {
  "x_fecha_hora": F("Día y hora", "datetime", req=True), "x_vehiculo_id": F("Unidad", "many2one", "fleet.vehicle"),
  "x_unidad_texto": F("Unidad (si no está en Flota)", "char"),
  "x_color": S("Color del llavero", ("rojo","ROJO · no sale"),("amarillo","AMARILLO · uso restringido"),("verde","VERDE · uso libre"), req=True),
  "x_restr_ruta": F("No salir a ruta", "boolean"), "x_restr_60": F("No superar 60 km/h", "boolean"),
  "x_restr_agua_aceite": F("Controlar agua y aceite", "boolean"), "x_restr_otra": F("Otra restricción", "char"),
  "x_entrego": F("Quién entregó", "char", req=True), "x_guardia_id": F("Guardia que recibe", "many2one", "x_seg360_guardia", req=True, on_delete="restrict"),
  "x_observaciones": F("Observaciones", "text"), "x_rojo_liberado": F("Rojo liberado por Responsable", "boolean"), **FIRMA}),
]
EXTRA = [("x_seg360_semana", "x_turno_ids", F("Turnos", "one2many", "x_seg360_turno", relation_field="x_semana_id"))]
SEQ = {"x_seg360_semana": ("SEM-%(year)s-", 3), "x_seg360_chequeo": ("CHQ-%(year)s-", 5), "x_seg360_llave": ("LLV-%(year)s-", 5)}
def accesos(gl, gr, ga):  # (leer, escribir, crear, borrar)
    return {
     "x_seg360_guardia": {gl: (1,0,0,0), gr: (1,1,1,0), ga: (1,0,0,0), G_DESA: (1,1,1,1)},
     "x_seg360_semana": {gl: (1,0,0,0), gr: (1,1,1,1), ga: (1,1,1,0), G_DESA: (1,1,1,1)},
     "x_seg360_turno": {gl: (1,0,0,0), gr: (1,1,1,1), ga: (1,1,1,1), G_DESA: (1,1,1,1)},
     "x_seg360_chequeo": {gl: (1,0,0,0), gr: (1,1,1,0), ga: (1,0,1,0), G_DESA: (1,1,1,1)},
     "x_seg360_llave": {gl: (1,0,0,0), gr: (1,1,1,0), ga: (1,0,1,0), G_DESA: (1,1,1,1)},
    }
LISTAS = {
 "x_seg360_guardia": "x_name x_legajo x_empresa x_active",
 "x_seg360_semana": "x_name x_inicio x_garita",
 "x_seg360_turno": "x_fecha x_turno x_guardia_id x_puesto x_semana_id",
 "x_seg360_chequeo": "x_name x_fecha_hora x_movimiento x_vehiculo_id x_unidad_texto x_tipo x_acceso x_guardia_id x_dictamen x_estado",
 "x_seg360_llave": "x_name x_fecha_hora x_vehiculo_id x_unidad_texto x_color x_entrego x_guardia_id x_firma_verificada",
}
def fs(*n): return "".join(f'<field name="{x}"/>' for x in n)
FORMS = {
 "x_seg360_guardia": f'<sheet><widget name="web_ribbon" title="Archivado" bg_color="text-bg-danger" invisible="x_active"/><h1><field name="x_name" placeholder="Nombre y apellido"/></h1><group><group>{fs("x_legajo","x_dni")}</group><group>{fs("x_empresa","x_active")}</group></group></sheet>',
 "x_seg360_semana": f'<sheet><h1><field name="x_name" readonly="1"/></h1><group><group>{fs("x_inicio","x_garita")}</group></group><field name="x_turno_ids"><list editable="bottom">{fs("x_fecha","x_turno","x_guardia_id","x_puesto")}</list></field><group>{fs("x_observaciones")}</group></sheet>',
 "x_seg360_turno": f'<sheet><group><group>{fs("x_semana_id","x_fecha","x_turno")}</group><group>{fs("x_guardia_id","x_puesto")}</group></group></sheet>',
 "x_seg360_chequeo": '<header><button name="%(lib)s" type="action" string="Liberar unidad" class="btn-primary" invisible="x_estado != \'bloqueada\'" groups="%(gr)s"/><field name="x_estado" widget="statusbar"/></header>'
   f'<sheet><widget name="web_ribbon" title="NO APTO" bg_color="text-bg-danger" invisible="x_dictamen != \'no_apto\'"/><widget name="web_ribbon" title="APTO" bg_color="text-bg-success" invisible="x_dictamen != \'apto\'"/>'
   f'<h1><field name="x_name" readonly="1"/></h1><group><group string="Movimiento">{fs("x_fecha_hora","x_movimiento","x_vehiculo_id","x_unidad_texto","x_tipo","x_acceso","x_km_horas")}</group>'
   f'<group string="Control visual">{fs("x_frenos","x_luces","x_vtv_vigente","x_documentacion","x_kit")}</group></group><group><group string="Dictamen">{fs("x_dictamen","x_motivos","x_bloqueante","x_autoriza","x_motivo_autorizacion")}</group>'
   f'<group string="Guardia y firma">{fs("x_guardia_id","x_firma_legajo","x_firma_verificada","x_firma_fecha")}</group></group>'
   f'<group string="Liberación" invisible="x_estado != \'liberada\'">{fs("x_liberado_por_id","x_liberado_el","x_motivo_liberacion")}</group><group>{fs("x_observaciones")}</group></sheet>',
 "x_seg360_llave": f'<sheet><h1><field name="x_name" readonly="1"/></h1><group><group string="Llave">{fs("x_fecha_hora","x_vehiculo_id","x_unidad_texto","x_color")}<field name="x_rojo_liberado" invisible="x_color != \'rojo\'" groups="__export__.seg360_responsable"/></group>'
   f'<group string="Restricciones (amarillo)" invisible="x_color != \'amarillo\'">{fs("x_restr_ruta","x_restr_60","x_restr_agua_aceite","x_restr_otra")}</group></group>'
   f'<group><group string="Entrega">{fs("x_entrego","x_guardia_id")}</group><group string="Firma">{fs("x_firma_legajo","x_firma_verificada","x_firma_fecha")}</group></group><group>{fs("x_observaciones")}</group></sheet>',
}
CHATTER = {"x_seg360_chequeo", "x_seg360_llave", "x_seg360_guardia", "x_seg360_semana"}
BUSQ = {"x_seg360_chequeo": '<search><field name="x_name"/><field name="x_vehiculo_id"/><field name="x_unidad_texto"/><field name="x_guardia_id"/>'
          '<filter name="bloq" string="Bloqueadas (NO APTO)" domain="[(\'x_estado\',\'=\',\'bloqueada\')]"/><filter name="noapto" string="NO APTO" domain="[(\'x_dictamen\',\'=\',\'no_apto\')]"/>'
          '<group><filter name="g_unidad" string="Unidad" context="{\'group_by\': \'x_vehiculo_id\'}"/></group></search>',
        "x_seg360_guardia": '<search><field name="x_name"/><field name="x_legajo"/><field name="x_empresa"/><filter name="arch" string="Archivados" domain="[(\'x_active\',\'=\',False)]"/></search>'}
CODIGO_NUMERO = """# Seguridad 360 · numeración al crear (%(m)s). Escribe: x_name.
for r in records:
    if not r.x_name or r.x_name in ('/', 'Nuevo'):
        r.write({'x_name': env['ir.sequence'].sudo().next_by_code('%(m)s') or '/'})
"""
CODIGO_BLOQUEO = """# Seguridad 360 · R-S360-1: NO APTO bloquea la unidad. Al crear un chequeo:
# - si es «Salida a uso» y la unidad tiene un chequeo «Bloqueada (NO APTO)» abierto → error, no se registra (no puede avanzar);
# - fija el estado: NO APTO → Bloqueada; APTO → Habilitada.
C = env['x_seg360_chequeo'].sudo()
for r in records:
    dom = [('id', '!=', r.id), ('x_estado', '=', 'bloqueada')]
    dom += [('x_vehiculo_id', '=', r.x_vehiculo_id.id)] if r.x_vehiculo_id else [('x_vehiculo_id', '=', False), ('x_unidad_texto', '=ilike', (r.x_unidad_texto or '').strip())]
    previo = C.search(dom, order='id desc', limit=1)
    if r.x_movimiento == 'salida' and previo:
        raise UserError('Unidad bloqueada por %s (NO APTO): no puede salir. Solo sale si el Jefe de Logística autoriza ese chequeo en Odoo (faltante de kit) o un Responsable libera la unidad.' % previo.x_name)
    # R-S360-3: la última devolución de llave en ROJO (sin liberar) bloquea la salida hasta una devolución VERDE/AMARILLO posterior.
    dl = [('x_vehiculo_id', '=', r.x_vehiculo_id.id)] if r.x_vehiculo_id else [('x_vehiculo_id', '=', False), ('x_unidad_texto', '=ilike', (r.x_unidad_texto or '').strip())]
    ll = env['x_seg360_llave'].sudo().search(dl, order='x_fecha_hora desc, id desc', limit=1)
    if r.x_movimiento == 'salida' and ll and ll.x_color == 'rojo' and not ll.x_rojo_liberado:
        raise UserError('Llavero ROJO en %s: la unidad no puede salir hasta una devolución VERDE o AMARILLO o que un Responsable lo libere.' % ll.x_name)
    r.write({'x_estado': 'bloqueada' if r.x_dictamen == 'no_apto' else 'habilitada'})
"""
CODIGO_LIBERAR = """# Seguridad 360 · Liberar unidad bloqueada (solo grupo Responsable).
if not env.user.has_group('%(xid)s') and not env.user.has_group('base.group_system'):
    raise UserError('Solo un Responsable de Seguridad 360 puede liberar la unidad.')
for r in records.filtered(lambda x: x.x_estado == 'bloqueada'):
    r.write({'x_estado': 'liberada', 'x_liberado_por_id': env.user.id, 'x_liberado_el': datetime.datetime.now(), 'x_motivo_liberacion': r.x_motivo_liberacion or 'Liberada desde Odoo'})
    r.message_post(body='Unidad liberada por %%s.' %% env.user.name)
"""

def backup():
    datos = {"modelos_existentes": c("ir.model", "search_read", [["model", "like", "x_seg360"]], fields=["model"]),
             "grupos_seg360": c("res.groups", "search_read", [["name", "like", "Seguridad 360"]], fields=["name", "user_ids"]),
             "menus_raiz": c("ir.ui.menu", "search_read", [["parent_id", "=", False], ["name", "=", "Seguridad 360"]], fields=["name"]),
             "usuarios": c("res.users", "read", LECT + RESP + API, fields=["login", "group_ids"])}
    ruta = os.environ.get("BACKUP_JSON")
    if ruta: json.dump(datos, open(ruta, "w"), ensure_ascii=False, indent=1); print("backup →", ruta)

def grupo(nom, desc, usuarios):
    g = c("res.groups", "search", [["name", "=", nom]])
    gid = g[0] if g else hacer(f"grupo «{nom}»", lambda: c("res.groups", "create", {"name": nom, "comment": desc}))
    if usuarios and gid: hacer(f"usuarios {usuarios} → «{nom}»", lambda: c("res.groups", "write", [gid], {"user_ids": [(4, u) for u in usuarios]}))
    return gid

def main():
    backup()
    gl = grupo("Seguridad 360 / Lectura", "Ve guardias, chequeos de portón y devoluciones de llave. Logística y COO.", LECT)
    gr = grupo("Seguridad 360 / Responsable", "Alta de guardias, semanas, corrige registros y libera unidades bloqueadas (NO APTO).", RESP)
    ga = grupo("Seguridad 360 / Servicio API", "Usuario de servicio de la app de garita (Render): lee guardias y unidades, crea chequeos, llaves y semanas.", API)
    ids = {}
    for mo, nombre, etq, campos in MODELOS:
        ex = c("ir.model", "search", [["model", "=", mo]])
        if ex: print("EXISTE", mo, ex[0]); ids[mo] = ex[0]; continue
        ids[mo] = hacer(f"modelo {mo} ({len(campos)} campos)", lambda: c("ir.model", "create", {"model": mo, "name": nombre, "state": "manual",
            "is_mail_thread": mo in CHATTER, "is_mail_activity": mo in CHATTER,
            "field_id": [(0, 0, {"name": "x_name", "ttype": "char", "field_description": etq, "required": mo != "x_seg360_turno"})]
                        + [(0, 0, {"name": n, **v}) for n, v in campos.items()]}))
    for mo, n, v in EXTRA:
        if not APLICAR or not c("ir.model.fields", "search", [["model", "=", mo], ["name", "=", n]]):
            hacer(f"campo {mo}.{n}", lambda: c("ir.model.fields", "create", {"model_id": ids[mo], "name": n, **v}))
    # valores por defecto
    for mo, campo, val in [("x_seg360_guardia", "x_active", True), ("x_seg360_semana", "x_garita", "S06"), ("x_seg360_chequeo", "x_estado", "habilitada")]:
        if APLICAR:
            f = c("ir.model.fields", "search", [["model", "=", mo], ["name", "=", campo]])
            if not c("ir.default", "search", [["field_id", "in", f]]):
                hacer(f"default {mo}.{campo}={val}", lambda: c("ir.default", "create", {"field_id": f[0], "json_value": json.dumps(val)}))
        else: print(f"HARÍA  default {mo}.{campo}={val}")
    for mo, perm in accesos(gl or 0, gr or 0, ga or 0).items():
        for g, (r, w, cr, u) in perm.items():
            if APLICAR and c("ir.model.access", "search", [["model_id", "=", ids[mo]], ["group_id", "=", g]]): continue
            hacer(f"acceso {mo} grupo {g} r{r}w{w}c{cr}u{u}", lambda: c("ir.model.access", "create", {"name": f"{mo}_g{g}", "model_id": ids[mo], "group_id": g,
                "perm_read": bool(r), "perm_write": bool(w), "perm_create": bool(cr), "perm_unlink": bool(u)}))
    for mo, (pre, pad) in SEQ.items():
        if not c("ir.sequence", "search", [["code", "=", mo]]):
            hacer(f"secuencia {mo} {pre}", lambda: c("ir.sequence", "create", {"name": f"Seguridad 360 · {mo}", "code": mo, "prefix": pre, "padding": pad}))
        nom = f"Seguridad 360 · Número {mo} (secuencia)"
        if not c("base.automation", "search", [["name", "=", nom]]):
            def auto(mo=mo, nom=nom):
                a = c("ir.actions.server", "create", {"name": nom + " (código)", "model_id": ids[mo], "state": "code", "usage": "base_automation", "code": CODIGO_NUMERO % {"m": mo}})
                return c("base.automation", "create", {"name": nom, "model_id": ids[mo], "trigger": "on_create", "action_server_ids": [(6, 0, [a])]})
            hacer(f"automatización {nom}", auto)
    nom = "Seguridad 360 · R-S360-1 NO APTO bloquea la unidad"
    if not c("base.automation", "search", [["name", "=", nom]]):
        def auto_b():
            a = c("ir.actions.server", "create", {"name": nom + " (código)", "model_id": ids["x_seg360_chequeo"], "state": "code", "usage": "base_automation", "code": CODIGO_BLOQUEO})
            return c("base.automation", "create", {"name": nom, "model_id": ids["x_seg360_chequeo"], "trigger": "on_create", "action_server_ids": [(6, 0, [a])]})
        hacer(f"automatización {nom}", auto_b)
    # botón liberar
    lib = c("ir.actions.server", "search", [["name", "=", "Seguridad 360 · Liberar unidad"]])
    lib = lib[0] if lib else hacer("acción servidor Liberar unidad", lambda: c("ir.actions.server", "create", {"name": "Seguridad 360 · Liberar unidad",
        "model_id": ids["x_seg360_chequeo"], "state": "code", "group_ids": [(6, 0, [gr])], "code": CODIGO_LIBERAR % {"xid": "__export__.seg360_responsable"}}))
    if APLICAR and gr and not c("ir.model.data", "search", [["module", "=", "__export__"], ["name", "=", "seg360_responsable"]]):
        hacer("xmlid __export__.seg360_responsable", lambda: c("ir.model.data", "create", {"module": "__export__", "name": "seg360_responsable", "model": "res.groups", "res_id": gr}))
    # vistas
    for mo, cols in LISTAS.items():
        if not c("ir.ui.view", "search", [["model", "=", mo], ["type", "=", "list"], ["name", "like", "seg360"]]):
            arch = "<list>" + "".join(f'<field name="{f}"/>' for f in cols.split()) + "</list>"
            hacer(f"vista lista {mo}", lambda: c("ir.ui.view", "create", {"name": f"{mo}.list.seg360", "model": mo, "type": "list", "arch": arch}))
        if not c("ir.ui.view", "search", [["model", "=", mo], ["type", "=", "form"], ["name", "like", "seg360"]]):
            body = FORMS[mo] % {"lib": lib or 0, "gr": "__export__.seg360_responsable"} if mo == "x_seg360_chequeo" else FORMS[mo]
            arch = "<form>" + body + ("<chatter/>" if mo in CHATTER else "") + "</form>"
            hacer(f"vista form {mo}", lambda: c("ir.ui.view", "create", {"name": f"{mo}.form.seg360", "model": mo, "type": "form", "arch": arch}))
        if mo in BUSQ and not c("ir.ui.view", "search", [["model", "=", mo], ["type", "=", "search"], ["name", "like", "seg360"]]):
            hacer(f"vista búsqueda {mo}", lambda: c("ir.ui.view", "create", {"name": f"{mo}.search.seg360", "model": mo, "type": "search", "arch": BUSQ[mo]}))
    acc = {}
    TIT = {"x_seg360_chequeo": "Chequeos en portón", "x_seg360_llave": "Devoluciones de llave", "x_seg360_semana": "Semanas de guardias",
           "x_seg360_turno": "Turnos de guardia", "x_seg360_guardia": "Guardias"}
    for mo, t in TIT.items():
        a = c("ir.actions.act_window", "search", [["res_model", "=", mo], ["name", "=", t]])
        acc[mo] = a[0] if a else hacer(f"acción {t}", lambda: c("ir.actions.act_window", "create", {"name": t, "res_model": mo, "view_mode": "list,form",
            "context": "{'search_default_bloq': 0}" if mo == "x_seg360_chequeo" else "{}"}))
    menus = {}
    raiz = c("ir.ui.menu", "search", [["name", "=", "Seguridad 360"], ["parent_id", "=", False]])
    if raiz: menus["raiz"] = raiz[0]
    else:
        def mk():
            r = c("ir.ui.menu", "create", {"name": "Seguridad 360", "sequence": 205, "group_ids": [(6, 0, [gl, gr, G_DESA])], "web_icon": "fleet,static/description/icon.png"})
            out = {"raiz": r}
            for i, (mo, t) in enumerate([("x_seg360_chequeo", None), ("x_seg360_llave", None), ("x_seg360_semana", None), ("x_seg360_turno", None), ("x_seg360_guardia", None)]):
                out[mo] = c("ir.ui.menu", "create", {"name": TIT[mo], "parent_id": r, "action": f"ir.actions.act_window,{acc[mo]}", "sequence": i + 1})
            return out
        menus = hacer("menú raíz «Seguridad 360» + 5 submenús", mk) or {}
    print("\nIDs:", json.dumps({"modelos": ids, "grupos": {"lectura": gl, "responsable": gr, "api": ga}, "acciones": acc, "liberar": lib, "menus": menus,
        "secuencias": c("ir.sequence", "search_read", [["code", "like", "x_seg360"]], fields=["code"]) if APLICAR else None}, default=str))
    if not APLICAR: print("SIMULACIÓN: no se creó nada.")
main()
