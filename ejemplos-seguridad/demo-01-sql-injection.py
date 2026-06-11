# ============================================================================
# 🧪 EJEMPLO ACTIVO #1 - SQL INJECTION (para probar el gate ML del pipeline)
# ============================================================================
# Este archivo SÍ contiene una vulnerabilidad ACTIVA (no comentada).
# Sirve para verificar que el flujo dev -> test detecta y BLOQUEA código inseguro.
#
# Resultado esperado al hacer PR dev -> test:
#   1. security-pipeline.yml ejecuta el scanner ML sobre este archivo
#   2. Detecta SQL_INJECTION (score esperado ~0.66, umbral del modelo = 0.57)
#   3. El job 'security-analysis' falla -> el PR queda BLOQUEADO
#   4. Llega notificación a Telegram: "🚨 VULNERABILIDADES DETECTADAS"
#   5. El auto-merge a 'test' NO ocurre
#
# Si quieres probar el CAMINO FELIZ (que llegue a producción), comenta con '#'
# la línea peligrosa de abajo y vuelve a hacer push.
# ============================================================================

from flask import request
import sqlite3


# def buscar_usuario():
#     """Endpoint vulnerable: concatena entrada del usuario directo en el SQL."""
#     conn = sqlite3.connect("livechat.db")
#     cursor = conn.cursor()

#     # 🔴 FUENTE: entrada controlada por el usuario (request.args)
#     user_id = request.args.get("id")

#     # 🔴 VULNERABILIDAD (línea activa): concatenación directa en la consulta SQL.
#     #     El modelo ML detecta: SELECT + concatenación ('+') sin parámetros (?, %s).
#     query = "SELECT * FROM usuarios WHERE id = '" + user_id + "'"

#     # 🔴 SUMIDERO: la consulta no sanitizada se ejecuta.
#     cursor.execute(query)

#     return cursor.fetchall()


# ----------------------------------------------------------------------------
# ✅ VERSIÓN SEGURA (referencia) — así se corregiría usando parámetros enlazados.
#    Está comentada con '#', por lo que el scanner la ignora.
# ----------------------------------------------------------------------------
def buscar_usuario_seguro():
    conn = sqlite3.connect("livechat.db")
    cursor = conn.cursor()
    user_id = request.args.get("id")
    query = "SELECT * FROM usuarios WHERE id = ?"   # placeholder parametrizado
    cursor.execute(query, [user_id])               # entrada enlazada, no concatenada
    return cursor.fetchall()
# cambios de seguridad: se reemplaza concatenación por parámetros enlazados (placeholders '?') y se pasa la entrada como argumento separado. Esto previene la inyección SQL.
