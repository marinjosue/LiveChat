# ============================================================================
# 🧪 EJEMPLOS COMENTADOS (INERTES) - Otros tipos de vulnerabilidad
# ============================================================================
# Todas las líneas peligrosas están comentadas con '#'.
# El scanner ML IGNORA las líneas que empiezan con '#'
# (ver model_vulnerabilities.py -> analyze_code filtra: not l.strip().startswith('#')).
#
# 👉 CÓMO PROBAR UN CASO:
#    1. Elige UN bloque de abajo.
#    2. Quita el '#' SOLO de las líneas marcadas con  <-- DESCOMENTAR
#    3. Haz commit en dev y abre PR dev -> test.
#    4. El gate ML debe detectarlo y bloquear el PR (revisa Telegram).
#    5. Vuelve a comentarlo cuando termines.
#
# ⚠️ Descomenta UN solo caso a la vez para ver claramente qué detecta cada uno.
# ============================================================================

from flask import request
import os
import pickle


# ----------------------------------------------------------------------------
# CASO 2 — COMMAND INJECTION   (tipo esperado: COMMAND_INJECTION, score ~0.86)
# ----------------------------------------------------------------------------
def hacer_ping():
    host = request.args.get("host")
    # os.system("ping -c 1 " + host)            # <-- DESCOMENTAR para probar
    return "ok"


# ----------------------------------------------------------------------------
# CASO 3 — PATH TRAVERSAL      (tipo esperado: PATH_TRAVERSAL, score ~0.68)
# ----------------------------------------------------------------------------
def leer_archivo():
    nombre = request.args.get("file")
    # contenido = open(request.args.get("file")).read()   # <-- DESCOMENTAR para probar
    return "ok"


# ----------------------------------------------------------------------------
# CASO 4 — INSECURE DESERIALIZATION  (tipo esperado: INSECURE_DESERIALIZATION, score ~0.82)
# ----------------------------------------------------------------------------
def cargar_objeto():
    datos = request.data
    # objeto = pickle.loads(request.data)       # <-- DESCOMENTAR para probar
    return "ok"


# ----------------------------------------------------------------------------
# CASO 5 — XSS / EVAL          (tipo esperado: XSS, score ~0.62)
# ----------------------------------------------------------------------------
def ejecutar_expresion():
    entrada = request.args.get("expr")
    # resultado = eval(request.args.get("expr"))   # <-- DESCOMENTAR para probar
    return "ok"
