# 🔐 Pipeline CI/CD con Seguridad ML

## 📋 Descripción

Pipeline automatizado de CI/CD que integra **detección de vulnerabilidades basada en Machine Learning** antes de permitir que el código llegue a producción.

### 🎯 Objetivo

Implementar un flujo de trabajo seguro (Secure DevOps) que:
- ✅ Clasifique código como **seguro** o **vulnerable**
- ✅ **Bloquee** merges si se detectan vulnerabilidades
- ✅ Solo permita código seguro en producción
- ✅ Aplique **Shift-Left Security** (seguridad desde el inicio)

---

## 🏗️ Arquitectura del Pipeline

```
┌─────────────────────────────────────────────────────────────┐
│                    Pull Request dev → test                   │
└────────────────────┬────────────────────────────────────────┘
                     │
                     ▼
┌─────────────────────────────────────────────────────────────┐
│  ETAPA 1: Análisis de Seguridad con ML  🔍                  │
├─────────────────────────────────────────────────────────────┤
│  • Modelo 1: Detección binaria (Vulnerable/Seguro)          │
│    - Accuracy: 79.01% | Recall: 90.12%                      │
│  • Modelo 2: Clasificación CWE (10 tipos)                   │
│    - Accuracy: 86.94%                                        │
│                                                              │
│  ❌ SI VULNERABLE:                                           │
│     - Bloqueo automático de merge                          │
│     - Issue creada automáticamente                         │
│     - Notificación vía Telegram                            │
│     - Pipeline FALLA ❌                                      │
│                                                              │
│  ✅ SI SEGURO:                                               │
│     - Continúa al siguiente stage                          │
└────────────────────┬────────────────────────────────────────┘
                     │
                     ▼
┌─────────────────────────────────────────────────────────────┐
│  ETAPA 2: Tests Automatizados 🧪                            │
├─────────────────────────────────────────────────────────────┤
│  • Tests unitarios (cliente + servidor)                     │
│  • Tests de integración                                     │
│                                                              │
│  ❌ SI FALLAN:                                               │
│     - Bloqueo de merge                                      │
│     - Notificación vía Telegram                            │
│     - Pipeline FALLA ❌                                      │
│                                                              │
│  ✅ SI PASAN:                                                │
│     - Aprobación automática para merge                     │
│     - Notificación de éxito                                │
└────────────────────┬────────────────────────────────────────┘
                     │
                     ▼ (solo si rama = main)
┌─────────────────────────────────────────────────────────────┐
│  ETAPA 3: Despliegue a Producción 🚀                        │
├─────────────────────────────────────────────────────────────┤
│  • Build de aplicación                                      │
│  • Deploy en proveedor cloud                                │
│  • Notificación de éxito/fallo                             │
└─────────────────────────────────────────────────────────────┘
```

---

## 🤖 Modelos de Machine Learning

### Restricciones cumplidas ✅

- ❌ **NO se usan LLMs** (GPT, Claude, Llama)
- ✅ **Clasificadores tradicionales**: Random Forest
- ✅ **Dataset público**: CyberNative DPO + SecurityEval
- ✅ **Entrenamiento completo**: 13,968 muestras totales

### Modelo 1: Detector Binario

**Propósito**: Clasificar código como vulnerable o seguro

**Características**:
- **Algoritmo**: Random Forest (200 árboles)
- **Features**: 1,001 (TF-IDF bigramas + language encoding)
- **Dataset**: 9,312 muestras balanceadas (50/50)
- **Performance**:
  - Accuracy: **79.01%**
  - Recall: **90.12%** (detecta 90% de vulnerabilidades reales)
  - ROC-AUC: **88.83%**
  - Overfitting: 6.80%

### Modelo 2: Clasificador CWE

**Propósito**: Clasificar el tipo de vulnerabilidad (10 categorías CWE)

**Características**:
- **Algoritmo**: Random Forest (250 árboles)
- **Features**: 1,200 (TF-IDF trigramas)
- **Dataset**: 3,715 muestras procesadas
- **Performance**:
  - Accuracy: **86.94%**
  - 5-Fold CV: **87.62% ± 0.60%**
  - Overfitting: 5.28% (muy bajo)

**Tipos CWE detectados**:
1. Buffer Overflow (CWE-120/121/122)
2. SQL Injection (CWE-89)
3. Code Injection (CWE-94/95)
4. XSS - Cross-Site Scripting (CWE-79)
5. Null Pointer / Null Safety
6. Insecure Deserialization
7. Memory Management
8. Improper Input Validation
9. Format String Attack
10. Uninitialized Variables

---

## 🌳 Estrategia de Ramas

### Ramas obligatorias:

```
main (producción)
  ↑
  │ (merge automático si todo pasa)
  │
test (staging/pruebas)
  ↑
  │ (PR trigger)
  │
dev (desarrollo)
```

### Flujo de trabajo:

1. **Desarrollo**: Trabajar en rama `dev`
2. **Pull Request**: Crear PR de `dev` → `test`
3. **Trigger Pipeline**: El PR activa automáticamente el pipeline
4. **Análisis ML**: Los modelos escanean el código
5. **Decisión**:
   - ✅ **Seguro**: Continúa a tests → puede hacer merge
   - ❌ **Vulnerable**: Bloqueo + issue creada + notificación
6. **Merge a test**: Aprobado automáticamente si pasa todo
7. **Merge a main**: Solo si viene de `test` y todo pasó

---

## 📦 Configuración Inicial

### 1. Secrets de GitHub

Configurar en: **Settings → Secrets and variables → Actions**

```bash
TELEGRAM_BOT_TOKEN=1234567890:ABCdefGHIjklMNOpqrsTUVwxyz
TELEGRAM_CHAT_ID=-1001234567890
```

### 2. Crear Bot de Telegram

```bash
1. Hablar con @BotFather en Telegram
2. Enviar: /newbot
3. Seguir instrucciones
4. Copiar el token
5. Obtener chat_id:
   - Crear grupo/canal
   - Agregar el bot
   - Enviar mensaje
   - Ir a: https://api.telegram.org/bot<TOKEN>/getUpdates
   - Copiar el chat_id
```

### 3. Protección de Ramas

**Settings → Branches → Branch protection rules**

Para rama `test`:
- ✅ Require status checks to pass before merging
- ✅ Require branches to be up to date
- ✅ Status checks: `security-analysis`, `unit-tests`

Para rama `main`:
- ✅ Todo lo anterior +
- ✅ Require pull request reviews before merging

---

## 🚀 Uso del Pipeline

### Crear un Pull Request

```bash
# Desde la rama dev
git checkout dev
git add .
git commit -m "feat: nueva funcionalidad"
git push origin dev

# Crear PR en GitHub: dev → test
# El pipeline se ejecutará automáticamente
```

### Ver el Progreso

1. **GitHub Actions**: Ve a la pestaña "Actions" en GitHub
2. **Telegram**: Recibirás notificaciones en tiempo real
3. **PR Comments**: El bot comentará en el PR con resultados

### Si se Detectan Vulnerabilidades

1. **Issue creada automáticamente** con detalles
2. **PR bloqueado** (no se puede hacer merge)
3. **Notificación Telegram** con archivos afectados
4. **Corregir el código** y hacer push
5. **Pipeline se re-ejecuta** automáticamente

---

## 📊 Reportes

### Reporte de Seguridad (JSON)

Se genera `security_report.json` con:

```json
{
  "timestamp": "2025-12-06T10:30:00",
  "summary": {
    "total": 45,
    "safe": 43,
    "vulnerable": 2,
    "errors": 0
  },
  "is_safe": false,
  "results": [
    {
      "file": "servidor/routes/users.js",
      "language": "JavaScript",
      "vulnerable": true,
      "detection_confidence": 0.87,
      "cwe_type": "SQL Injection",
      "cwe_confidence": 0.92,
      "status": "VULNERABLE"
    }
  ]
}
```

### Artifacts

Los reportes se guardan por 30 días en GitHub Actions:
- `security-report`: Análisis completo
- Test coverage (si está configurado)

---

## 🔧 Customización

### Cambiar Umbral de Confianza

Editar `.github/scripts/scan_vulnerabilities.py`:

```python
# Solo alertar si confianza > 80%
if is_vulnerable and confidence > 0.80:
    # Reportar vulnerabilidad
```

### Agregar más Lenguajes

Editar `EXT_TO_LANG` en el script:

```python
EXT_TO_LANG = {
    'js': 'JavaScript',
    'rs': 'Rust',  # Agregar Rust
    'sol': 'Solidity',  # Agregar Solidity
    # ...
}
```

### Cambiar Proveedor de Deploy

Editar workflow, etapa 3:

```yaml
deploy:
  steps:
    - name: Deploy to Vercel
      run: vercel deploy --prod
    
    # O Railway:
    - name: Deploy to Railway
      run: railway up
    
    # O Render:
    - name: Deploy to Render
      run: render deploy
```

---

## 📈 Métricas del Pipeline

### Performance Esperada

- ⚡ Análisis ML: ~30-60 segundos
- 🧪 Tests: ~1-2 minutos
- 🚀 Deploy: ~3-5 minutos
- **Total**: ~5-8 minutos por PR

### Tasa de Detección

Basado en métricas de entrenamiento:
- **True Positive Rate**: 90.12% (detecta 90% de vulnerabilidades reales)
- **False Positive Rate**: ~20% (falsos positivos aceptables)
- **Accuracy**: 79.01% (precisión general)

---

## 🎓 Principios de Seguridad Aplicados

### ✅ Shift-Left Security

Seguridad desde el inicio del desarrollo, no al final.

### ✅ Secure DevOps

Integración de seguridad en el pipeline CI/CD.

### ✅ Zero Trust

No confiar en ningún código sin verificación.

### ✅ Defense in Depth

Múltiples capas: ML → Tests → Review → Deploy.

### ✅ Fail-Safe

Si falla algo, el pipeline se detiene (no despliega código vulnerable).

---

## 🐛 Troubleshooting

### Pipeline falla en análisis ML

```bash
# Verificar que existan los modelos
ls -la ml-security/models/

# Debe mostrar:
# vulnerability_detector.pkl
# cwe_classifier.pkl
# vectorizer_*.pkl
# *_encoder.pkl
```

### Notificaciones Telegram no llegan

```bash
# Verificar secrets
echo $TELEGRAM_BOT_TOKEN
echo $TELEGRAM_CHAT_ID

# Probar manualmente
curl -X POST "https://api.telegram.org/bot$TELEGRAM_BOT_TOKEN/sendMessage" \
  -d "chat_id=$TELEGRAM_CHAT_ID" \
  -d "text=Test"
```

### False Positives

Si el modelo reporta vulnerabilidades incorrectas:
1. Revisar el código manualmente
2. Si es falso positivo, documentar en issue
3. Considerar reentrenar modelo con más datos

---

## 📚 Referencias

- **Documentación completa del modelo**: `ml-security/README.md`
- **Tests del modelo**: `ml-security/test/`
- **Datasets**: `ml-security/data/processed/`
- **API del modelo**: `ml-security/backend/app.py`

---

## 👥 Soporte

Para reportar problemas o sugerencias:
1. Crear issue en GitHub
2. Etiquetar con `pipeline` o `security`
3. Incluir logs del workflow

---

**🔒 Security First - ML Powered - Automated Protection** 🛡️
