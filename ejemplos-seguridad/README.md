# 🧪 Ejemplos de prueba del Pipeline CI/CD (Gate de Seguridad ML)

Esta carpeta contiene código de ejemplo para **verificar que el flujo de seguridad
funciona**: que el modelo ML detecta vulnerabilidades y **bloquea** el merge antes
de que lleguen a producción.

## 🔁 Recordatorio del flujo

```
dev ──PR──► test ──(auto si pasa)──► main ──(auto)──► Producción (Render + Vercel)
        │                    │
   [ML Security gate]   [Tests Jest]
```

- El **scanner ML** (`security-pipeline.yml`) solo corre en **PR `dev` → `test`**.
- Solo analiza los **archivos modificados** en ese PR
  (`git diff origin/test...HEAD`, extensiones `.js .py .ts ...`).
- Si encuentra una vulnerabilidad con score **≥ 0.57**, **falla el job y bloquea el PR**.

## 📂 Archivos

| Archivo | Estado | Para qué sirve |
|---------|--------|----------------|
| `demo-01-sql-injection.py` | 🔴 **ACTIVO** (vulnerable) | Probar que el gate **detecta y bloquea**. |
| `demo-02-comentados.py`    | ⚪ Inerte (comentado) | Otros 4 tipos de vuln. para probar uno a uno. |

> ℹ️ El scanner **ignora las líneas que empiezan con `#`**, por eso los ejemplos
> comentados quedan "apagados" hasta que les quitas el `#`.

## ▶️ Paso 1 — Probar que el flujo funciona (ejemplo activo)

1. Asegúrate de estar en la rama `dev`.
2. Estos archivos ya introducen una vulnerabilidad activa (`demo-01-sql-injection.py`).
3. Haz commit y abre un **PR `dev` → `test`**.
4. Resultado esperado:
   - ✅ El workflow `🔐 Security Pipeline` se ejecuta.
   - 🚨 Comenta en el PR: **`❌ VULNERABLE`** con el detalle de `SQL_INJECTION`.
   - 📱 Llega a Telegram: **"🚨 VULNERABILIDADES DETECTADAS"**.
   - 🚫 El **auto-merge a `test` NO ocurre** → el PR queda bloqueado.

Si ves eso, **el gate de seguridad funciona correctamente.** ✅

## ▶️ Paso 2 — Probar el camino feliz (que llegue a producción)

1. En `demo-01-sql-injection.py`, **comenta** (con `#`) o elimina la línea marcada
   como `🔴 VULNERABILIDAD` (la del `query = "SELECT ... " + user_id + ...`).
2. Commit + push → reabre/actualiza el PR `dev` → `test`.
3. Resultado esperado:
   - ✅ `✅ SEGURO` en el PR → auto-merge a `test`.
   - 🧪 Corren los tests (Jest) en `test`.
   - 🔀 Si pasan → auto-merge `test` → `main`.
   - 🚀 Se dispara `deploy-production.yml` (Render + Vercel).

## ▶️ Paso 3 — Probar los otros tipos de vulnerabilidad

En `demo-02-comentados.py`, quita el `#` de **un solo** caso (línea marcada
`<-- DESCOMENTAR`), haz PR `dev` → `test`, verifica que lo detecta, y vuelve a
comentarlo:

| Caso | Tipo detectado | Score aprox. |
|------|----------------|--------------|
| 2 | `COMMAND_INJECTION` | ~0.86 |
| 3 | `PATH_TRAVERSAL` | ~0.68 |
| 4 | `INSECURE_DESERIALIZATION` | ~0.82 |
| 5 | `XSS` (eval) | ~0.62 |

> Umbral del modelo: **0.57**. Todos los casos superan el umbral → deben bloquear.

## ⚠️ Importante

- Estos archivos son **solo para pruebas del pipeline**. No los importes ni los
  ejecutes en la aplicación real.
- Cuando termines de validar, elimina esta carpeta o deja todos los casos comentados
  para no dejar código inseguro en el repositorio.
