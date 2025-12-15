# 🔍 FLUJO DETECCIÓN DE VULNERABILIDADES - Validación Específica

## 📋 Resumen Ejecutivo

El sistema detecta vulnerabilidades en **3 pasos principales** dentro del workflow de GitHub Actions, con **activaciones específicas** en cada punto.

---

## 🔄 FLUJO COMPLETO: DEV → TEST → MAIN

```
┌─────────────────────────────────────────────────────────────────┐
│                    1. PUSH/PR A RAMA DEV                        │
│                  (security-pipeline.yml)                         │
└─────────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────────┐
│  📥 Checkout + 🐍 Python 3.10 + 📦 pip install scikit-learn    │
└─────────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────────┐
│   📂 Descargar modelos ML desde ml-security/models/             │
│   - vulnerability_detector.pkl                                   │
│   - cwe_classifier.pkl                                           │
│   - vectorizers y encoders                                       │
└─────────────────────────────────────────────────────────────────┘
                              ↓
          ╔════════════════════════════════════════╗
          ║  PASO 1: scan_vulnerabilities.py      ║ ← DETECCIÓN
          ║  .github/scripts/scan_vulnerabilities ║
          ╚════════════════════════════════════════╝
                              ↓
┌─────────────────────────────────────────────────────────────────┐
│ Salida: vulnerability_report.json                               │
│ {                                                                │
│   "timestamp": "2025-12-14T...",                                │
│   "files_scanned": 47,                                          │
│   "vulnerabilities": [                                          │
│     {                                                            │
│       "file": "cliente/src/vulnerableCode.js",                  │
│       "line": 45,                                               │
│       "type": "Cross-Site Scripting (XSS)",                     │
│       "confidence": 0.95,                                       │
│       "language": "javascript"                                  │
│     }                                                            │
│   ],                                                             │
│   "summary": {                                                   │
│     "total": 3,                                                 │
│     "critical": 1,                                              │
│     "high": 1,                                                  │
│     "medium": 1                                                 │
│   }                                                              │
│ }                                                                │
└─────────────────────────────────────────────────────────────────┘
                              ↓
          ╔════════════════════════════════════════╗
          ║  PASO 2: notify_telegram.py            ║ ← NOTIFICACIÓN
          ║  (Si is_safe == false)                 ║
          ╚════════════════════════════════════════╝
                              ↓
┌─────────────────────────────────────────────────────────────────┐
│ MENSAJE TELEGRAM CON:                                            │
│                                                                  │
│ ╔════════════════════════════════════════╗                      │
│ ║  🚨 ALERTA DE SEGURIDAD               ║                      │
│ ║  VULNERABILIDADES DETECTADAS          ║                      │
│ ╚════════════════════════════════════════╝                      │
│                                                                  │
│ 📊 ESTADÍSTICAS:                                                │
│   📁 Total archivos: 47                                         │
│   ✅ Seguros: 44                                                │
│   🚨 Vulnerables: 3                                             │
│                                                                  │
│ 🔴 VULNERABILIDADES DETECTADAS:                                 │
│   #1 - vulnerableCode.js                                        │
│   📍 Ruta: cliente/src/vulnerableCode.js                        │
│   💻 Lenguaje: javascript                                       │
│   🏷️  Tipo CWE: Cross-Site Scripting (XSS)                      │
│   📈 Severidad: 🔴 ALTA                                          │
│   🎯 Confianza: 95.0%                                            │
│                                                                  │
│ ❌ Estado: RECHAZADO - REQUIERE CORRECCIONES                    │
│ 🔧 Por favor, corrige las vulnerabilidades detectadas           │
│                                                                  │
│ 📦 Repositorio: marinjosue/LiveChat                             │
│ 🌿 Rama: dev                                                    │
│ 👤 Autor: @usuario                                              │
│ 💾 Commit: a1b2c3d                                              │
└─────────────────────────────────────────────────────────────────┘
                              ↓
          ╔════════════════════════════════════════╗
          ║  PASO 3: check_vulnerabilities.py      ║ ← BLOQUEO
          ║  (.github/scripts/check_vulnerabilities)║
          ╚════════════════════════════════════════╝
                              ↓
┌─────────────────────────────────────────────────────────────────┐
│ LÓGICA DE DECISIÓN:                                              │
│                                                                  │
│ if vulnerabilidades > 0:                                        │
│     echo "❌ 3 vulnerabilidad(es) detectada(s)"                  │
│     echo "  - cliente/src/vulnerableCode.js:45"                 │
│     echo "    - Cross-Site Scripting (XSS) (95.0%)"             │
│     exit(1)  ← FALLA EL WORKFLOW                                │
│ else:                                                            │
│     echo "✅ Sin vulnerabilidades detectadas"                   │
│     exit(0)  ← CONTINÚA EL WORKFLOW                             │
└─────────────────────────────────────────────────────────────────┘
                              ↓
                    ¿FLUJO EXITOSO?
                         ↙    ↘
                    SI        NO
                    ↓         ↓
            COMENTA PR    FALLA WORKFLOW
            CON ✅        (EXIT CODE 1)
            
            PR puede      PR RECHAZADO
            mergear       No puede hacer merge
```

---

## 🎯 ¿QUÉ ACTIVA EL MENSAJE EN CADA PASO?

### **PASO 1: Detección (scan_vulnerabilities.py)**

**¿Cuándo se ejecuta?**
```yaml
on:
  push:
    branches: [ dev ]
    paths:
      - '**.py'
      - '**.js'
      - '**.java'
      - '**.cpp'
      - '**.cs'
      - '**.php'
      - '**.rb'
      - '**.swift'
      - '**.go'
      - '**.kt'
      - '**.f90'
  pull_request:
    branches: [ dev ]
```

**Cómo activa el mensaje:**

1. **Escanea archivos** buscando patrones peligrosos:
   ```python
   dangerous_patterns = [
       r'eval\s*\(',          # Code execution
       r'exec\s*\(',          # Command execution
       r'os\.system\s*\(',    # System calls
       r'subprocess\s*\(',    # Subprocess
       r'strcpy\s*\(',        # Buffer overflow
       r'SELECT.*FROM.*WHERE',# SQL Injection
       r'INSERT.*INTO.*VALUES',
       r'<script',            # XSS
       r'innerHTML\s*=',      # DOM-based XSS
   ]
   ```

2. **Detecta por confianza** (threshold 50%):
   ```python
   if confidence > 0.5:  # ← UMBRAL DE ACTIVACIÓN
       vulnerability = {
           'file': file_path,
           'line': line_num,
           'code': code_snippet[:100],
           'type': vuln_type,
           'confidence': float(confidence)
       }
       vulnerabilities.append(vulnerability)
   ```

3. **Calcula confianza dinámicamente**:
   ```python
   confidence = 0.6  # Base 60%
   
   if vuln_type == "SQL Injection":
       if any(pat in code_lower for pat in ['where', 'from', 'select']):
           confidence = 0.90  # ← Aumenta a 90%
   
   elif vuln_type == "Code Injection":
       if 'eval(' in code_lower:
           confidence = 0.95  # ← Sube a 95%
   ```

4. **Genera reporte JSON**:
   ```python
   report = {
       'timestamp': datetime.now(),
       'files_scanned': 47,
       'vulnerabilities': [...],  # Solo si encontró
       'summary': {
           'total': 3,
           'critical': 1,  # > 85%
           'high': 1,      # 70-85%
           'medium': 1     # 50-70%
       }
   }
   ```

---

### **PASO 2: Notificación (notify_telegram.py)**

**¿Cuándo se ejecuta?**
```yaml
- name: 📱 Notificar vulnerabilidades a Telegram
  if: always()  # ← SIEMPRE SE EJECUTA
  run: python .github/scripts/notify_telegram.py
  env:
    TELEGRAM_BOT_TOKEN: ${{ secrets.TELEGRAM_BOT_TOKEN }}
    TELEGRAM_CHAT_ID: ${{ secrets.TELEGRAM_CHAT_ID }}
```

**Cómo activa el mensaje:**

1. **Lee el reporte generado**:
   ```python
   with open('vulnerability_report.json', 'r') as f:
       report = json.load(f)
   ```

2. **Decide el tipo de mensaje**:
   ```python
   is_safe = report['is_safe']  # Si vulnerabilities == 0
   
   if is_safe:
       message = "✅ ANÁLISIS DE SEGURIDAD EXITOSO"
   else:
       message = "🚨 ALERTA DE SEGURIDAD - VULNERABILIDADES DETECTADAS"
   ```

3. **Construye el mensaje dinámico**:
   ```python
   # Encabezado
   message = "🔴 El código contiene vulnerabilidades\n"
   message += "⚠️  Requiere correcciones antes del merge\n"
   
   # Estadísticas
   message += f"📁 Total archivos: {summary['total']}\n"
   message += f"🚨 Vulnerables: {summary['vulnerable']}\n"
   
   # Detalles (hasta 5 vulnerabilidades)
   for vuln in vuln_results[:5]:
       message += f"  #{idx} - {file_name}\n"
       message += f"  🏷️  Tipo CWE: {cwe_type}\n"
       message += f"  📈 Severidad: {severity}\n"
       message += f"  🎯 Confianza: {detection_conf*100:.1f}%\n"
   ```

4. **Envía a Telegram**:
   ```python
   url = f"https://api.telegram.org/bot{self.bot_token}/sendMessage"
   response = requests.post(url, json={
       'chat_id': self.chat_id,
       'text': message,
       'parse_mode': 'HTML'
   })
   ```

---

### **PASO 3: Bloqueo (check_vulnerabilities.py)**

**¿Cuándo se ejecuta?**
```yaml
- name: ❌ Fallar si hay cualquier vulnerabilidad
  run: python .github/scripts/check_vulnerabilities.py
  continue-on-error: false  # ← NO CONTINÚA SI FALLA
```

**Cómo activa el bloqueo:**

```python
#!/usr/bin/env python3
import json
import sys

with open('vulnerability_report.json') as f:
    report = json.load(f)

vulnerabilities = report.get('vulnerabilities', [])

if vulnerabilities:  # ← CONDICIÓN DE BLOQUEO
    print(f'❌ {len(vulnerabilities)} vulnerabilidad(es) detectada(s)')
    for v in vulnerabilities[:3]:
        print(f'  - {v["file"]}:{v["line"]} - {v["type"]} ({v["confidence"]*100:.1f}%)')
    sys.exit(1)  # ← FALLA EL WORKFLOW (EXIT CODE 1)
else:
    print('✅ Sin vulnerabilidades detectadas')
    sys.exit(0)  # ← CONTINÚA (EXIT CODE 0)
```

**Consecuencias:**
- Si `exit(1)`: El workflow **FALLA** 🔴
- El PR recibe etiqueta `vulnerability-detected`
- **No se puede hacer merge** hasta corregir
- Si `exit(0)`: El workflow **PASA** ✅
- PR puede ser mergeado a `test`

---

## 🔗 INTEGRACIÓN EN FLUJO COMPLETO

```
git push origin dev
    ↓
GitHub Actions dispara: security-pipeline.yml
    ↓
[1] scan_vulnerabilities.py
    ├─ Busca patrones peligrosos
    ├─ Calcula confianza por patrón
    └─ Genera vulnerability_report.json
    ↓
[2] notify_telegram.py (if always())
    ├─ Lee vulnerability_report.json
    ├─ Formatea mensaje
    └─ Envía a Telegram
    ↓
[3] check_vulnerabilities.py (continue-on-error: false)
    ├─ Lee vulnerability_report.json
    ├─ Si vulnerabilities > 0: exit(1) ❌
    └─ Si no: exit(0) ✅
    ↓
    ├─ Si FALLA (exit 1):
    │   ├─ PR comentado con ⚠️
    │   ├─ No puede mergear
    │   └─ Requiere correcciones
    │
    └─ Si PASA (exit 0):
        ├─ PR comentado con ✅
        └─ Puede mergear a test
```

---

## 📊 TABLA DE ACTIVACIONES

| Evento | Script | Condición | Acción |
|--------|--------|-----------|--------|
| **push a dev** | scan_vulnerabilities.py | pathsMatch | ✅ Escanea archivos |
| **always()** | notify_telegram.py | exit code any | 📱 Notifica siempre |
| **vulnerabilities found** | check_vulnerabilities.py | count > 0 | ❌ Falla workflow |
| **no vulnerabilities** | check_vulnerabilities.py | count == 0 | ✅ Continúa workflow |

---

## 🎯 EJEMPLO REAL

**Archivo: `cliente/src/vulnerableCode.js`**
```javascript
45 | eval(userInput);  // ← PATRÓN PELIGROSO
```

**Ejecución:**

1. **scan_vulnerabilities.py detecta:**
   ```
   Pattern matched: eval\s*\(
   Type: Code Injection
   Confidence base: 0.6
   Confidence final: 0.95 (eval( = 95% confianza)
   ```

2. **notify_telegram.py envía:**
   ```
   🚨 ALERTA DE SEGURIDAD
   
   🏷️  Tipo CWE: Code Injection
   📈 Severidad: 🔴 ALTA
   🎯 Confianza: 95.0%
   ```

3. **check_vulnerabilities.py falla:**
   ```
   ❌ 1 vulnerabilidad(es) detectada(s)
   - cliente/src/vulnerableCode.js:45 - Code Injection (95.0%)
   exit(1)  → WORKFLOW FALLA
   ```

---

## ✅ RESUMEN ACTIVACIONES

| Paso | Se Activa | Por Qué | Efecto |
|------|-----------|--------|--------|
| 1️⃣ **Detección** | `confidence > 0.5` | Patrones encontrados | 📊 Report JSON |
| 2️⃣ **Notificación** | `always()` | Siempre (sin condición) | 📱 Telegram |
| 3️⃣ **Bloqueo** | `vulnerabilities > 0` | Si hay detectadas | ❌ Exit(1) |

