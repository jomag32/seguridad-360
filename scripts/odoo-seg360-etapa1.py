#!/usr/bin/env python3
"""Seguridad 360 · Etapa 1 (reparación): «Apto con observación» en portón + «Ingreso a mantenimiento» sobre la app estándar Mantenimiento.
NO APLICADO: requiere OK de Jorge. Modos: --dry-run (default, solo lee) · --apply (backup JSON antes) · --rollback (borra lo creado por este script).
Entorno: ODOO_URL, ODOO_DB, ODOO_UID (2), ODOO_API_KEY, BACKUP_JSON (opcional).
Crea (si no existe):
 A. x_seg360_chequeo: valor «apto_obs» en x_dictamen; campos x_gravedad, x_obs_falla, x_ingreso_previsto, x_obs_logistica, x_ingreso_id; vista heredada.
    R-S360-1 no cambia: todo lo que no sea no_apto queda «habilitada» (la unidad sale con observación).
 B. x_seg360_plazo (parámetros editables gravedad × tipo → horas) con los valores iniciales del documento «Control Flota 360°».
 C. maintenance.equipment.x_vehiculo_id (→ fleet.vehicle), categoría «UNIDADES DE FLOTA» y un equipo por cada vehículo de Flota que no tenga.
 D. maintenance.request: causa, sistema, cómo llega, OK del guardia, km/horas de llegada, validación de Logística, reloj (x_ingreso_fecha); vista heredada.
 E. etapa «Ingreso a validar (Logística)» (antes de «A iniciar»).
 F. Automatizaciones: R-S360-4 km de llegada no menor al último registro · R-S360-5 «No valida» archiva el pedido (vuelve a Playa) y deja nota
    con quién declaró · R-S360-6 ingreso previsto vencido → pedido de ingreso con causa «Ingreso previsto vencido».
 G. Accesos del grupo «Seguridad 360 / Servicio API» a pedidos/equipos/etapas/plazos."""
import os, sys, json, datetime, re, unicodedata, xmlrpc.client
APPLY, ROLLBACK = "--apply" in sys.argv, "--rollback" in sys.argv
U, D, UID, K = os.environ["ODOO_URL"], os.environ["ODOO_DB"], int(os.environ.get("ODOO_UID", "2")), os.environ["ODOO_API_KEY"]
m = xmlrpc.client.ServerProxy(U + "/xmlrpc/2/object", allow_none=True)
def c(mo, me, *a, **k): return m.execute_kw(D, UID, K, mo, me, list(a), k)
def clave(t): return re.sub(r"^_|_$", "", re.sub(r"[^a-z0-9]+", "_", "".join(ch for ch in unicodedata.normalize("NFD", t) if not unicodedata.combining(ch)).lower()))[:30]
def sel(*ts): return [(clave(t), t) for t in ts]   # misma clave que SEL() en datos-odoo.js
HECHO = []
def hacer(que, fn):
    HECHO.append(que); print(("APLICA " if APPLY else "HARÍA  ") + que)
    return fn() if APPLY else None
def S(etq, opciones, **kw): return {"ttype": "selection", "field_description": etq, "selection_ids": [(0, 0, {"value": v, "name": n, "sequence": i}) for i, (v, n) in enumerate(opciones)], **kw}
def F(etq, t, rel=None, **kw): return {"ttype": t, "field_description": etq, **({"relation": rel} if rel else {}), **kw}

CAUSAS = sel("Falla en uso", "No apto en portón", "Ingreso previsto vencido", "Daño o accidente", "Service por km u horas", "Vencimiento documental")
SISTEMAS = sel("Frenos", "Luces / eléctrico", "Motor", "Caja / transmisión", "Dirección / suspensión", "Neumáticos", "Refrigeración", "Hidráulico", "Carrocería", "Climatización", "Kit obligatorio", "Documentación", "Service preventivo", "Otro")
LLEGADAS = sel("Por sus medios", "Remolcada", "En grúa o carretón", "Quedó en la calle: la trae Logística")
UBICACIONES = sel("Taller propio", "Playa en espera", "En proveedor", "Varada en obra o ruta")  # «En proveedor»: lógica en etapa 2
GRAV = [("alta", "Alta"), ("media", "Media"), ("baja", "Baja")]
TIPOS = [("liviano", "Liviano"), ("pesado", "Pesado"), ("maquina", "Máquina"), ("semirremolque", "Semirremolque")]
PLAZOS = {"alta": dict(liviano=24, pesado=24, maquina=24, semirremolque=24), "media": dict(liviano=72, pesado=48, maquina=48, semirremolque=48)}  # Baja: próximo service (sin plazo)
CAMPOS = {
 "x_seg360_chequeo": {"x_gravedad": S("Gravedad de la falla", GRAV), "x_obs_falla": F("Observación (apto con observación)", "text"),
   "x_ingreso_previsto": F("Ingreso previsto (fecha límite)", "date"), "x_obs_logistica": F("Logística que fijó la observación", "char"),
   "x_ingreso_id": F("Ingreso a mantenimiento", "many2one", "maintenance.request", on_delete="set null")},
 "maintenance.equipment": {"x_vehiculo_id": F("Unidad de Flota", "many2one", "fleet.vehicle", on_delete="restrict", index="btree")},
 "maintenance.request": {"x_vehiculo_id": F("Unidad de Flota", "many2one", "fleet.vehicle", on_delete="restrict"), "x_unidad_texto": F("Unidad (si no está en Flota)", "char"),
   "x_causa": S("Causa declarada", CAUSAS), "x_sistema": S("Sistema afectado", SISTEMAS), "x_declaro": F("Declaró (chofer u operador)", "char"),
   "x_llegada": S("Cómo llega", LLEGADAS), "x_guardia_id": F("OK de llegada: guardia", "many2one", "x_seg360_guardia", on_delete="restrict"),
   "x_ok_guardia_fecha": F("OK de llegada: fecha y hora", "datetime"), "x_km_horas_llegada": F("Km u horas de llegada", "float"),
   "x_firma_legajo": F("Firma: legajo del guardia", "char"), "x_firma_verificada": F("Firma verificada (legajo + DNI)", "boolean"),
   "x_validacion": S("Validación de Logística", [("pendiente", "A validar"), ("valida", "Valida: ingresa"), ("rechazada", "No valida: vuelve a Playa disponible")]),
   "x_valido_por": F("Validó / rechazó (Logística)", "char"), "x_validacion_fecha": F("Fecha de validación", "datetime"),
   "x_ingreso_fecha": F("Ingreso a taller (corre el plazo)", "datetime"), "x_rechazo_motivo": F("Motivo de no validación", "text"),
   "x_chequeo_id": F("Chequeo de portón (NO APTO)", "many2one", "x_seg360_chequeo", on_delete="set null"),
   "x_ubicacion": S("Ubicación", UBICACIONES), "x_fotos_pendientes": F("Fotos pendientes (las completa el guardia)", "boolean")},
}
PLAZO_MODELO = "x_seg360_plazo"
PLAZO_CAMPOS = {"x_gravedad": S("Gravedad", GRAV, required=True), "x_tipo": S("Tipo de unidad", TIPOS, required=True), "x_horas": F("Plazo (horas)", "integer"), "x_active": F("Activo", "boolean")}
ETAPA = "Ingreso a validar (Logística)"; CATEG = "UNIDADES DE FLOTA"
VISTAS = {
 "x_seg360_chequeo": ("x_seg360_chequeo.form.seg360.etapa1", '<data><xpath expr="//field[@name=\'x_dictamen\']" position="after">'
   '<field name="x_gravedad" invisible="x_dictamen != \'apto_obs\'"/><field name="x_obs_falla" invisible="x_dictamen != \'apto_obs\'"/>'
   '<field name="x_ingreso_previsto" invisible="x_dictamen != \'apto_obs\'"/><field name="x_obs_logistica" invisible="x_dictamen != \'apto_obs\'"/>'
   '<field name="x_ingreso_id"/></xpath></data>'),
 "maintenance.request": ("maintenance.request.form.seg360.etapa1", '<data><xpath expr="//field[@name=\'equipment_id\']" position="after">'
   '<field name="x_vehiculo_id"/><field name="x_unidad_texto" invisible="x_vehiculo_id"/></xpath>'
   '<xpath expr="//sheet" position="inside"><group string="Ingreso a mantenimiento (Seguridad 360)"><group>'
   '<field name="x_causa"/><field name="x_sistema"/><field name="x_declaro"/><field name="x_llegada"/><field name="x_km_horas_llegada"/></group><group>'
   '<field name="x_guardia_id"/><field name="x_ok_guardia_fecha"/><field name="x_firma_verificada"/><field name="x_validacion" decoration-success="x_validacion == \'valida\'"/>'
   '<field name="x_valido_por"/><field name="x_validacion_fecha"/><field name="x_ingreso_fecha"/><field name="x_rechazo_motivo" invisible="x_validacion != \'rechazada\'"/>'
   '<field name="x_ubicacion"/><field name="x_fotos_pendientes"/><field name="x_chequeo_id"/></group></group></xpath>'
   '<xpath expr="//header" position="inside">__BOTONES__</xpath></data>'),
}
AUTOS = [
 ("Seguridad 360 · R-S360-4 km/horas de llegada no menor al último registro", "maintenance.request", "on_create", None,
  "for r in records:\n    if not r.x_vehiculo_id or not r.x_km_horas_llegada:\n        continue\n"
  "    a = env['x_seg360_chequeo'].sudo().search([('x_vehiculo_id', '=', r.x_vehiculo_id.id)], order='id desc', limit=1)\n"
  "    b = env['maintenance.request'].sudo().search([('id', '!=', r.id), ('x_vehiculo_id', '=', r.x_vehiculo_id.id)], order='id desc', limit=1)\n"
  "    ult = max(a.x_km_horas or 0, b.x_km_horas_llegada or 0)\n"
  "    if r.x_km_horas_llegada < ult:\n        raise UserError('Km/horas de llegada (%s) menor que el último registro (%s).' % (r.x_km_horas_llegada, ult))\n"),
 ("Seguridad 360 · R-S360-5 No valida → vuelve a Playa disponible", "maintenance.request", "on_write", [("x_validacion", "=", "rechazada")],
  "for r in records:\n    r.message_post(body='No validado por %s: %s. Vuelve a Playa disponible. Declaró: %s.' % (r.x_valido_por or '', r.x_rechazo_motivo or '', r.x_declaro or ''))\n"
  "    r.write({'archive': True})\n"),
 ("Seguridad 360 · R-S360-6 ingreso previsto vencido → pedido de ingreso", "x_seg360_chequeo", "on_time", [("x_dictamen", "=", "apto_obs"), ("x_ingreso_id", "=", False)],
  "for r in records:\n    eq = env['maintenance.equipment'].sudo().search([('x_vehiculo_id', '=', r.x_vehiculo_id.id)], limit=1) if r.x_vehiculo_id else False\n"
  "    st = env['maintenance.stage'].sudo().search([('name', '=', '" + ETAPA + "')], limit=1)\n"
  "    mr = env['maintenance.request'].sudo().create({'name': 'Ingreso · Ingreso previsto vencido', 'equipment_id': eq.id if eq else False, 'x_vehiculo_id': r.x_vehiculo_id.id,"
  " 'x_unidad_texto': r.x_unidad_texto, 'x_causa': 'ingreso_previsto_vencido', 'description': r.x_obs_falla, 'x_declaro': 'Sistema (vencimiento de ingreso previsto)',"
  " 'x_validacion': 'pendiente', 'priority': '2', 'x_chequeo_id': r.id, 'stage_id': st.id if st else False})\n"
  "    r.write({'x_ingreso_id': mr.id})\n"),
]
# Botones Valida / No valida en el formulario del pedido (mismo efecto que la app). Grupo: «Seguridad 360 / Autoriza salida» (Jefe de Logística).
G_LOG = "Seguridad 360 / Autoriza salida"
BOTONES = [
 ("Seguridad 360 · Valida: ingresa", "valida",
  "st = env['maintenance.stage'].search([('name', '=', 'A iniciar')], limit=1)\n"
  "for r in records.filtered(lambda x: x.x_validacion == 'pendiente'):\n"
  "    r.write({'x_validacion': 'valida', 'x_valido_por': env.user.name, 'x_validacion_fecha': datetime.datetime.now(), 'x_ingreso_fecha': datetime.datetime.now(),"
  " 'x_ubicacion': r.x_ubicacion or 'taller_propio', 'stage_id': st.id or r.stage_id.id})\n"),
 ("Seguridad 360 · No valida: vuelve a Playa disponible", "rechaza",
  "for r in records.filtered(lambda x: x.x_validacion == 'pendiente'):\n"
  "    if not (r.x_rechazo_motivo or '').strip():\n        raise UserError('No valida: cargá primero el «Motivo de no validación».')\n"
  "    r.write({'x_validacion': 'rechazada', 'x_valido_por': env.user.name, 'x_validacion_fecha': datetime.datetime.now()})\n"),
]
G_API = "Seguridad 360 / Servicio API"; G_RESP = "Seguridad 360 / Responsable"
ACCESOS = [("maintenance.request", G_API, (1, 1, 1, 0)), ("maintenance.equipment", G_API, (1, 0, 0, 0)), ("maintenance.stage", G_API, (1, 0, 0, 0)),
           (PLAZO_MODELO, G_API, (1, 0, 0, 0)), (PLAZO_MODELO, G_RESP, (1, 1, 1, 1))]

def mid(model): r = c("ir.model", "search", [["model", "=", model]]); return r[0] if r else None
def campos(model): return {f["name"]: f["id"] for f in c("ir.model.fields", "search_read", [["model", "=", model], ["name", "=like", "x_%"]], fields=["name"])}
print("modo:", "APPLY" if APPLY else "ROLLBACK" if ROLLBACK else "DRY-RUN (no cambia nada)")
inst = {x["name"]: x["state"] for x in c("ir.module.module", "search_read", [["name", "in", ["maintenance", "fleet", "base_automation"]]], fields=["name", "state"])}
print("módulos:", inst); assert all(v == "installed" for v in inst.values()), "falta un módulo"
vehs = c("fleet.vehicle", "search_read", [], fields=["license_plate", "display_name", "model_id"]); RENOMBRES = []
eq_campos = campos("maintenance.equipment")
ya_mapeados = {e["x_vehiculo_id"][0] for e in c("maintenance.equipment", "search_read", [["x_vehiculo_id", "!=", False]], fields=["x_vehiculo_id"])} if "x_vehiculo_id" in eq_campos else set()

if ROLLBACK:
    if "x_seg360_chequeo" in [x["model"] for x in c("ir.model", "search_read", [["model", "=", "x_seg360_chequeo"]], fields=["model"])]:
        n = c("x_seg360_chequeo", "search_count", [["x_dictamen", "=", "apto_obs"]]) if True else 0
        if n: sys.exit(f"ABORTA: {n} chequeos con x_dictamen=apto_obs. Pasarlos a «apto» antes del rollback.")
    for nombre, *_ in AUTOS:
        for a in c("base.automation", "search_read", [["name", "=", nombre]], fields=["action_server_ids"]):
            print("borra automatización", nombre); c("base.automation", "unlink", [a["id"]]); c("ir.actions.server", "unlink", a["action_server_ids"])
    for nb, _, _ in BOTONES:
        a = c("ir.actions.server", "search", [["name", "=", nb]]); a and (print("borra acción", nb), c("ir.actions.server", "unlink", a))
    for _, (nv, _) in VISTAS.items():
        v = c("ir.ui.view", "search", [["name", "=", nv]]); v and (print("borra vista", nv), c("ir.ui.view", "unlink", v))
    cat = c("maintenance.equipment.category", "search", [["name", "=", CATEG]])
    if cat:
        rb = os.environ.get("BACKUP_EQUIPOS")  # archivo *-equipos.json del --apply: restaura nombre/categoría de los equipos reutilizados
        previos = json.load(open(rb)) if rb else []
        for e in previos: print("restaura equipo", e["equipo_id"]); c("maintenance.equipment", "write", [e["equipo_id"]], {"name": e["nombre_anterior"], "category_id": e["categoria_anterior"] and e["categoria_anterior"][0], "x_vehiculo_id": False})
        eqs = c("maintenance.equipment", "search", [["category_id", "in", cat], ["id", "not in", [e["equipo_id"] for e in previos]]]); print("borra equipos de flota creados", len(eqs))
        if not rb and c("maintenance.equipment", "search_count", [["category_id", "in", cat], ["create_date", "<", "2026-10-29"]]): sys.exit("ABORTA: hay equipos reutilizados; pasá BACKUP_EQUIPOS=<backup>-equipos.json")
        if c("maintenance.request", "search_count", [["equipment_id", "in", eqs]]): sys.exit("ABORTA: hay pedidos de mantenimiento sobre esos equipos.")
        c("maintenance.equipment", "unlink", eqs); c("maintenance.equipment.category", "unlink", cat)
    st = c("maintenance.stage", "search", [["name", "=", ETAPA]])
    if st: print("borra etapa", ETAPA); c("maintenance.request", "search_count", [["stage_id", "in", st]]) and sys.exit("ABORTA: hay pedidos en la etapa"); c("maintenance.stage", "unlink", st)
    for mo, fs in CAMPOS.items():
        ex = campos(mo); ids = [ex[f] for f in fs if f in ex]
        if ids: print("borra campos", mo, [f for f in fs if f in ex]); c("ir.model.fields", "unlink", ids)
    pm = mid(PLAZO_MODELO); pm and (print("borra modelo", PLAZO_MODELO), c("ir.model", "unlink", [pm]))
    sv = c("ir.model.fields.selection", "search", [["field_id.model", "=", "x_seg360_chequeo"], ["field_id.name", "=", "x_dictamen"], ["value", "=", "apto_obs"]])
    sv and (print("borra valor apto_obs"), c("ir.model.fields.selection", "unlink", sv))
    print("rollback listo"); sys.exit(0)

if APPLY:
    ruta = os.environ.get("BACKUP_JSON") or f"backup-etapa1-{datetime.datetime.now():%Y%m%d-%H%M%S}.json"
    json.dump({"campos": {mo: c("ir.model.fields", "search_read", [["model", "=", mo]], fields=["name", "ttype", "field_description", "required"]) for mo in CAMPOS},
               "etapas": c("maintenance.stage", "search_read", [], fields=["name", "sequence", "done", "fold"]),
               "categorias": c("maintenance.equipment.category", "search_read", [], fields=["name"]),
               "equipos": c("maintenance.equipment", "search_read", [], fields=["name", "category_id"]),
               "vistas": c("ir.ui.view", "search_read", [["model", "in", list(VISTAS)]], fields=["name", "inherit_id", "arch_db"]),
               "automatizaciones": c("base.automation", "search_read", [["model_id.model", "in", list(VISTAS)]], fields=["name", "trigger"]),
               "accesos": c("ir.model.access", "search_read", [["model_id.model", "in", [a[0] for a in ACCESOS]]], fields=["name", "group_id", "perm_read", "perm_write", "perm_create", "perm_unlink"])},
              open(ruta, "w"), ensure_ascii=False, indent=1, default=str)
    print("backup →", ruta)

# A. chequeo: valor apto_obs
fd = c("ir.model.fields", "search_read", [["model", "=", "x_seg360_chequeo"], ["name", "=", "x_dictamen"]], fields=["id"])[0]["id"]
if not c("ir.model.fields.selection", "search", [["field_id", "=", fd], ["value", "=", "apto_obs"]]):
    hacer(f"valor de selección apto_obs «APTO con observación» en x_seg360_chequeo.x_dictamen (campo id {fd})",
          lambda: c("ir.model.fields.selection", "create", {"field_id": fd, "value": "apto_obs", "name": "APTO con observación", "sequence": 1}))
# B. modelo de plazos
pm = mid(PLAZO_MODELO)
if not pm:
    pm = hacer(f"modelo {PLAZO_MODELO} «Seguridad 360 · Plazo de ingreso previsto» con {list(PLAZO_CAMPOS)}", lambda: c("ir.model", "create", {"model": PLAZO_MODELO, "name": "Seguridad 360 · Plazo de ingreso previsto", "state": "manual",
        "field_id": [(0, 0, {"name": "x_name", "field_description": "Nombre", "ttype": "char", "state": "manual"})] + [(0, 0, {"name": k, "state": "manual", **v}) for k, v in PLAZO_CAMPOS.items()]}))
# fix: un modelo manual nace sin ACL; sin esto ni el admin puede crear los parámetros. Accesos antes de cargar registros.
G_SYS = c("ir.model.data", "search_read", [["module", "=", "base"], ["name", "=", "group_system"]], fields=["res_id"])[0]["res_id"]
if APPLY and pm and not c("ir.model.access", "search", [["model_id", "=", pm], ["group_id", "=", G_SYS]]):
    hacer(f"acceso {PLAZO_MODELO} · Administración/Ajustes (id {G_SYS}) r1 w1 c1 u1", lambda: c("ir.model.access", "create", {"name": f"seg360 etapa1 {PLAZO_MODELO} sistema", "model_id": pm, "group_id": G_SYS,
        "perm_read": 1, "perm_write": 1, "perm_create": 1, "perm_unlink": 1}))
elif not APPLY: hacer(f"acceso {PLAZO_MODELO} · Administración/Ajustes (id {G_SYS}) r1 w1 c1 u1", lambda: None)
for g, porTipo in PLAZOS.items():
    for t, h in porTipo.items():
        if pm and APPLY and c(PLAZO_MODELO, "search", [["x_gravedad", "=", g], ["x_tipo", "=", t]]): continue
        hacer(f"parámetro {PLAZO_MODELO}: {g} · {t} = {h} h", lambda g=g, t=t, h=h: c(PLAZO_MODELO, "create", {"x_name": f"{g} · {t}", "x_gravedad": g, "x_tipo": t, "x_horas": h, "x_active": True}))
# A/C/D. campos
for mo, fs in CAMPOS.items():
    ex = campos(mo); model_id = mid(mo)
    for f, v in fs.items():
        if f in ex: print("ya existe", mo, f); continue
        hacer(f"campo {mo}.{f} ({v['ttype']}{' → ' + v['relation'] if 'relation' in v else ''}) «{v['field_description']}»",
              lambda mo=mo, f=f, v=v, model_id=model_id: c("ir.model.fields", "create", {"model_id": model_id, "name": f, "state": "manual", **v}))
# C. categoría + un equipo por vehículo
cat = c("maintenance.equipment.category", "search", [["name", "=", CATEG]])
cat = cat[0] if cat else hacer(f"categoría de equipos «{CATEG}»", lambda: c("maintenance.equipment.category", "create", {"name": CATEG}))
falta = [v for v in vehs if v["id"] not in ya_mapeados]
def nombre(v):
    mod = v["model_id"][1] if v.get("model_id") else v["display_name"]
    return f"{v['license_plate']} · {mod}" if v["license_plate"] else mod
norm = lambda t: re.sub(r"[^a-z0-9]", "", (t or "").lower())
equipos = c("maintenance.equipment", "search_read", [], fields=["name", "category_id"])
nuevos = vinculados = 0
for v in falta:
    p = norm(v["license_plate"]); ex = [e for e in equipos if p and p in norm(e["name"])]
    if len(ex) == 1:  # unifica: reusa el equipo existente (nombre viejo queda en el backup y en BACKUP_NOMBRES)
        e = ex[0]; vinculados += 1; RENOMBRES.append({"equipo_id": e["id"], "nombre_anterior": e["name"], "categoria_anterior": e["category_id"]})
        hacer(f"vincula equipo existente id {e['id']} → fleet.vehicle {v['id']} y lo renombra «patente · modelo» (nombre anterior al backup)",
              lambda e=e, v=v: c("maintenance.equipment", "write", [e["id"]], {"name": nombre(v), "x_vehiculo_id": v["id"], "category_id": cat}))
    else:
        nuevos += 1
        hacer(f"equipo nuevo «patente · modelo» (fleet.vehicle {v['id']}) en {CATEG}", lambda v=v: c("maintenance.equipment", "create", {"name": nombre(v), "category_id": cat, "x_vehiculo_id": v["id"]}))
print(f"vehículos en Flota: {len(vehs)} · ya con equipo: {len(ya_mapeados)} · nuevos: {nuevos} · vinculados/renombrados: {vinculados}")
if APPLY and RENOMBRES: json.dump(RENOMBRES, open(ruta.replace(".json", "-equipos.json"), "w"), ensure_ascii=False, indent=1, default=str)
# E. etapa
if not c("maintenance.stage", "search", [["name", "=", ETAPA]]):
    hacer(f"etapa de Mantenimiento «{ETAPA}» sequence 0 (antes de «A iniciar» id 1)", lambda: c("maintenance.stage", "create", {"name": ETAPA, "sequence": 0, "done": False, "fold": False}))
# botones (acciones de servidor, solo grupo Logística)
grupos = {g["name"]: g["id"] for g in c("res.groups", "search_read", [["name", "in", [G_API, G_RESP, G_LOG]]], fields=["name"])}
bids = {}
for nb, k, code in BOTONES:
    ex = c("ir.actions.server", "search", [["name", "=", nb]])
    bids[k] = ex[0] if ex else hacer(f"acción de servidor «{nb}» (maintenance.request, solo grupo «{G_LOG}» id {grupos.get(G_LOG)})",
        lambda nb=nb, code=code: c("ir.actions.server", "create", {"name": nb, "model_id": mid("maintenance.request"), "state": "code", "code": code, "group_ids": [(6, 0, [grupos[G_LOG]])]}))
btn = "".join(f'<button name="{bids.get(k) or "<id>"}" type="action" string="{t}" class="{cl}" groups="__export__.seg360_autoriza_salida" invisible="x_validacion != \'pendiente\'"/>'
              for k, t, cl in [("valida", "Valida: ingresa", "btn-primary"), ("rechaza", "No valida: vuelve a Playa", "btn-secondary")])
VISTAS["maintenance.request"] = (VISTAS["maintenance.request"][0], VISTAS["maintenance.request"][1].replace("__BOTONES__", btn))
# vistas
base = {"x_seg360_chequeo": c("ir.ui.view", "search", [["name", "=", "x_seg360_chequeo.form.seg360"], ["inherit_id", "=", False]]),
        "maintenance.request": c("ir.ui.view", "search", [["model", "=", "maintenance.request"], ["type", "=", "form"], ["inherit_id", "=", False]], order="priority, id")}
for mo, (nv, arch) in VISTAS.items():
    if c("ir.ui.view", "search", [["name", "=", nv]]): print("ya existe vista", nv); continue
    hacer(f"vista heredada {nv} sobre {mo} vista base {base[mo][:1]}", lambda mo=mo, nv=nv, arch=arch: c("ir.ui.view", "create", {"name": nv, "model": mo, "inherit_id": base[mo][0], "mode": "extension", "type": "form", "arch_db": arch}))
# F. automatizaciones
for nombre, mo, trig, dom, code in AUTOS:
    if c("base.automation", "search", [["name", "=", nombre]]): print("ya existe", nombre); continue
    extra = {"trg_date_id": None, "trg_date_range": 0, "trg_date_range_type": "day"} if trig == "on_time" else {}
    def crear(nombre=nombre, mo=mo, trig=trig, dom=dom, code=code, extra=extra):
        model_id = mid(mo)
        if trig == "on_time": extra["trg_date_id"] = c("ir.model.fields", "search", [["model", "=", mo], ["name", "=", "x_ingreso_previsto"]])[0]
        act = c("ir.actions.server", "create", {"name": nombre, "model_id": model_id, "state": "code", "code": code})
        return c("base.automation", "create", {"name": nombre, "model_id": model_id, "trigger": trig, "filter_domain": repr(dom) if dom else False, "action_server_ids": [(6, 0, [act])], **extra})
    hacer(f"automatización «{nombre}» ({mo}, {trig}{', ' + repr(dom) if dom else ''})", crear)
# G. accesos
for mo, g, (r_, w, cr, u) in ACCESOS:
    gid = grupos.get(g)
    if mid(mo) and gid and c("ir.model.access", "search", [["model_id.model", "=", mo], ["group_id", "=", gid]]): print("ya existe acceso", mo, g); continue
    hacer(f"acceso {mo} · {g} (id {gid}) r{r_} w{w} c{cr} u{u}", lambda mo=mo, gid=gid, r_=r_, w=w, cr=cr, u=u: c("ir.model.access", "create", {"name": f"seg360 etapa1 {mo} {gid}", "model_id": mid(mo), "group_id": gid,
        "perm_read": r_, "perm_write": w, "perm_create": cr, "perm_unlink": u}))
print(f"\n{len(HECHO)} operaciones.", "listo" if APPLY else "DRY-RUN: nada cambió. Aplicar con --apply (hace backup antes).")
