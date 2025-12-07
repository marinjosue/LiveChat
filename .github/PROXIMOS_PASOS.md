# ⚡ Guía Rápida: Próximos Pasos

## 🎯 El Pipeline Está Configurado

El flujo completo **dev → test → main** está implementado y listo para usar.

## 📋 Checklist Antes de Empezar

### 1. ✅ Verificar Secrets en GitHub
- [ ] `TELEGRAM_BOT_TOKEN` configurado
- [ ] `TELEGRAM_CHAT_ID` configurado

### 2. ✅ Crear Ramas Faltantes
Actualmente solo tienes `dev` y `main`. Necesitas crear `test`:

```bash
# Crear rama test desde main
git checkout main
git pull origin main
git checkout -b test
git push origin test
```

### 3. ✅ Cerrar PR Actual (#1)
El PR #1 actual va de `dev → main` (flujo incorrecto). Debes cerrarlo:
- Ir a GitHub
- Cerrar PR #1
- No hacer merge

## 🚀 Cómo Probar el Pipeline

### Paso 1: Crear PR Correcto (dev → test)

```bash
# Asegurarte de estar en dev
git checkout dev
git pull origin dev

# Ir a GitHub y crear PR: dev → test
```

### Paso 2: Observar el Flujo Automático

1. **Análisis ML de Seguridad:**
   - Se ejecuta `security-pipeline.yml`
   - Recibes notificación en Telegram
   - Si es seguro: Merge automático a `test`
   - Si es vulnerable: Pipeline bloqueado

2. **Tests Automáticos (en rama test):**
   - Se ejecuta `test-pipeline.yml` automáticamente
   - Recibes notificación por componente
   - Si pasan todos: PR automático a `main`
   - Si fallan: Pipeline bloqueado

3. **PR a Main (automático):**
   - Se crea PR automáticamente: `test → main`
   - Revisas (opcional)
   - Haces merge manual
   - Se despliega automáticamente

## 🧪 Probar con Código Vulnerable (Opcional)

Para verificar que el ML detecta vulnerabilidades:

```javascript
// servidor/test-vulnerable.js
const eval_test = eval('1+1'); // CWE-95: Eval injection
document.innerHTML = userInput; // CWE-79: XSS
```

Push a `dev` y crea PR a `test`. Deberías recibir:
- ❌ Notificación de código vulnerable
- 🏷️ Labels en el PR
- 📋 Issue creada
- 💬 Comentario con detalles

## 📱 Notificaciones que Recibirás

### Si todo va bien:
1. ✅ "CÓDIGO SEGURO" (Etapa 1)
2. 🔀 "MERGE AUTOMÁTICO EXITOSO" (Etapa 1→2)
3. ✅ "TESTS PASADOS - servidor" (Etapa 2)
4. ✅ "TESTS PASADOS - cliente" (Etapa 2)
5. 🚀 "LISTO PARA PRODUCCIÓN" (Etapa 2→3)
6. 🚀 "DESPLIEGUE INICIADO" (Etapa 3)
7. ✅ "DESPLIEGUE EXITOSO" (Etapa 3)

### Si algo falla:
- ❌ "CÓDIGO VULNERABLE DETECTADO" → Corregir y volver a dev
- ❌ "TESTS FALLIDOS" → Corregir y volver a dev
- ❌ "ERROR EN DESPLIEGUE" → Revisar configuración

## 🔍 Dónde Ver los Resultados

1. **Telegram:** Todas las notificaciones
2. **GitHub Actions:** `Actions` → Ver workflows corriendo
3. **PR:** Comentarios automáticos con análisis ML
4. **Issues:** Creadas automáticamente si hay vulnerabilidades
5. **Labels:** Aplicadas automáticamente en PRs

## ⚠️ Importante

### Flujo CORRECTO:
```
dev → test (ML) → test (Tests) → main (Deploy)
```

### Flujo INCORRECTO (no usar):
```
dev → main ❌
```

## 🎓 Recursos

- **Flujo Completo:** `.github/FLUJO_PIPELINE.md`
- **Configuración:** `.github/PIPELINE_SETUP.md`
- **Secretos:** `.github/SECRETS_CONFIG.md`

## 🆘 Si Algo Falla

1. Revisar notificación de Telegram (tiene detalles)
2. Revisar logs en GitHub Actions
3. Revisar comentarios en el PR
4. Revisar issues creadas automáticamente

## ✅ Verificación Final

Antes de crear el PR, verifica:
- [ ] Rama `test` existe
- [ ] Secrets configurados en GitHub
- [ ] Bot de Telegram funciona
- [ ] PR #1 antiguo cerrado

## 🚀 ¡Listo para Empezar!

Ahora solo necesitas:
1. Crear rama `test`
2. Crear PR: `dev → test`
3. Observar la magia automática 🪄

---

🤖 **Todo está automatizado. Solo crea el PR y el pipeline hace el resto.**
