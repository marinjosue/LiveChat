# 🔐 Pipeline CI/CD Seguro con IA - LiveChat

## 📋 Descripción General

Pipeline automatizado de seguridad que utiliza **Machine Learning (Random Forest)** para detectar vulnerabilidades en código fuente antes de llegar a producción.

### ✨ Características

- ✅ **Clasificador ML sin LLMs** (Random Forest con scikit-learn)
- ✅ **Shift-Left Security** - Detección temprana de vulnerabilidades
- ✅ **Secure DevOps** - Integración completa con CI/CD
- ✅ **Bloqueo automático** de código vulnerable
- ✅ **Notificaciones Telegram** en tiempo real
- ✅ **Creación automática de issues** para vulnerabilidades
- ✅ **Despliegue automatizado** a producción

---

## 🏗️ Arquitectura del Pipeline

```
┌─────────────┐
│     dev     │ ──┐
└─────────────┘   │
                  │ PR trigger
┌─────────────┐   │
│    test     │ ◄─┴─► 🔍 Security Analysis (ML)
└─────────────┘       │
                      ├─► ✅ Seguro → Merge + Tests
                      └─► ❌ Vulnerable → Block + Issue + Notify
┌─────────────┐
│    main     │ ──► 🚀 Deploy to Production
└─────────────┘
```

---

## 🤖 Modelo de IA

### Tipo de Modelo
- **Algoritmo**: Random Forest Classifier
- **Framework**: scikit-learn 1.3.2
- **Características extraídas**:
  - Funciones peligrosas (eval, exec, system, etc.)
  - Patrones SQL Injection
  - Patrones XSS
  - Path Traversal
  - Validación de entrada
  - Autenticación

### Métricas de Rendimiento
- **Precisión**: ~95%+ (con dataset balanceado)
- **Validación cruzada**: 5-fold
- **Balance de clases**: class_weight='balanced'

### Dataset
El modelo se entrena con ejemplos de:
- ✅ Código seguro (parametrizado, validado, sanitizado)
- ❌ Código vulnerable (SQL Injection, XSS, RCE, Path Traversal)

---

## 🚀 Configuración Inicial

### 1. Instalar Dependencias del Modelo

```bash
cd ml-security
pip install -r requirements.txt
```

### 2. Entrenar el Modelo

```bash
cd ml-security
python train_model.py
```

Esto generará:
- `vulnerability_classifier.pkl` - Modelo entrenado
- `model_metadata.json` - Métricas y metadatos

### 3. Configurar Secrets en GitHub

Ve a tu repositorio → Settings → Secrets and variables → Actions

Agrega los siguientes secrets:

| Secret | Descripción | Cómo obtenerlo |
|--------|-------------|----------------|
| `TELEGRAM_BOT_TOKEN` | Token del bot de Telegram | [@BotFather](https://t.me/BotFather) → /newbot |
| `TELEGRAM_CHAT_ID` | ID del chat donde recibir notificaciones | [@userinfobot](https://t.me/userinfobot) → /start |

**Opcional (para Docker Hub)**:
- `DOCKER_USERNAME`
- `DOCKER_PASSWORD`

### 4. Crear Bot de Telegram (Paso a Paso)

1. Abre Telegram y busca [@BotFather](https://t.me/BotFather)
2. Envía el comando `/newbot`
3. Elige un nombre para tu bot (ej: "LiveChat Security Bot")
4. Elige un username (debe terminar en 'bot', ej: "livechat_security_bot")
5. Copia el **token** que te proporciona (formato: `123456789:ABCdefGHIjklMNOpqrsTUVwxyz`)
6. Para obtener tu **Chat ID**:
   - Busca [@userinfobot](https://t.me/userinfobot)
   - Envía `/start`
   - Copia tu **ID** (número)

---

## 🔄 Flujo del Pipeline

### Etapa 1: Pull Request (dev → test)

1. **Trigger**: Se abre un PR de `dev` hacia `test`
2. **Security Analysis**:
   - Checkout del código
   - Instalación de dependencias ML
   - Carga/entrenamiento del modelo
   - Escaneo de `cliente/src` y `servidor/`
   - Generación de reporte `security_report.json`

3. **Resultados**:
   - ✅ **Código Seguro**:
     - Comentario en el PR con detalles
     - Notificación Telegram ✅
     - Continúa al siguiente stage
   
   - ❌ **Código Vulnerable**:
     - Comentario detallado en el PR
     - Creación automática de issue
     - Notificación Telegram 🔴
     - **Pipeline FALLA** - Bloqueo de merge

### Etapa 2: Tests Unitarios

- Solo se ejecuta si el análisis de seguridad pasa
- Pruebas en paralelo para `cliente` y `servidor`
- Si fallan: notificación y bloqueo

### Etapa 3: Merge Approval

- Aprobación automática cuando todos los checks pasan
- Notificación de aprobación en Telegram

### Etapa 4: Deploy a Producción (main)

1. **Trigger**: Push a `main`
2. **Build**:
   - Build del cliente (React)
   - Build del servidor (Node.js)
3. **Docker**:
   - Construcción de imágenes Docker
4. **Deploy**:
   - Despliegue a proveedor cloud
5. **Notificación** final (éxito o error)

---

## 📁 Estructura de Archivos

```
LiveChat/
├── .github/
│   └── workflows/
│       ├── security-pipeline.yml      # Pipeline principal
│       └── deploy-production.yml      # Deploy a producción
├── ml-security/
│   ├── requirements.txt               # Dependencias ML
│   ├── train_model.py                 # Entrenamiento del modelo
│   ├── vulnerability_scanner.py       # Escáner de vulnerabilidades
│   ├── vulnerability_classifier.pkl   # Modelo entrenado (generado)
│   └── model_metadata.json            # Metadatos del modelo (generado)
├── scripts/
│   └── telegram_notify.py             # Notificaciones Telegram
├── Dockerfile.cliente                 # Docker para React
├── Dockerfile.servidor                # Docker para Node.js
├── docker-compose.yml                 # Orquestación local
└── nginx.conf                         # Configuración nginx
```

---

## 🧪 Pruebas Locales

### Probar el Escáner

```bash
cd ml-security

# Escanear el cliente
python vulnerability_scanner.py ../cliente/src

# Escanear el servidor
python vulnerability_scanner.py ../servidor

# Ver el reporte
cat security_report.json
```

### Probar Docker

```bash
# Construir imágenes
docker build -t livechat-cliente:test -f Dockerfile.cliente .
docker build -t livechat-servidor:test -f Dockerfile.servidor .

# Ejecutar con docker-compose
docker-compose up -d

# Ver logs
docker-compose logs -f

# Detener
docker-compose down
```

### Probar Notificaciones

```bash
# Configurar variables de entorno
$env:TELEGRAM_BOT_TOKEN="tu_token_aqui"
$env:TELEGRAM_CHAT_ID="tu_chat_id_aqui"

# Enviar notificación de prueba
python scripts/telegram_notify.py security_alert "LiveChat" "123" "usuario" "3"
```

---

## 🔍 Cómo Funciona el Detector ML

### 1. Extracción de Características

El modelo analiza el código y extrae:

```python
{
  'dangerous_funcs': 2,        # eval(), exec()
  'sql_keywords': 5,           # SELECT, WHERE, etc.
  'xss_patterns': 1,           # <script>, innerHTML
  'path_traversal': 0,         # ../, ../../
  'code_length': 245,          # Longitud del código
  'has_input_validation': 0,   # validate(), sanitize()
  'has_authentication': 0      # jwt, token, auth
}
```

### 2. Clasificación

El Random Forest evalúa las características y predice:
- `0` = Código Seguro ✅
- `1` = Código Vulnerable ❌

Con un nivel de confianza (0-100%)

### 3. Reporte

Genera un reporte JSON detallado:

```json
{
  "total_files": 25,
  "vulnerable_files": 2,
  "secure_files": 23,
  "is_safe": false,
  "vulnerable_list": [
    {
      "file": "servidor/routes/user.js",
      "vulnerable": true,
      "confidence": 0.87,
      "issues": [
        "⚠️ Posible SQL Injection (sin validación)",
        "⚠️ Funciones peligrosas detectadas"
      ]
    }
  ]
}
```

---

## 🎯 Patrones de Vulnerabilidades Detectadas

### SQL Injection
```javascript
// ❌ Vulnerable
const query = 'SELECT * FROM users WHERE id = ' + userId;

// ✅ Seguro
const query = 'SELECT * FROM users WHERE id = ?';
db.query(query, [userId]);
```

### XSS (Cross-Site Scripting)
```javascript
// ❌ Vulnerable
element.innerHTML = userInput;

// ✅ Seguro
element.textContent = userInput;
```

### Remote Code Execution
```javascript
// ❌ Vulnerable
eval(userCode);

// ✅ Seguro
const allowedFunctions = { add, subtract };
allowedFunctions[userChoice]();
```

### Path Traversal
```javascript
// ❌ Vulnerable
const file = fs.readFileSync('../../' + userPath);

// ✅ Seguro
const normalized = path.normalize(userPath).replace(/^(\\.\\.[/\\\\])+/, '');
```

---

## 📱 Notificaciones Telegram

### Ejemplo: Código Vulnerable

```
🔴 ALERTA DE SEGURIDAD

📦 Repositorio: marinjosue/LiveChat
🔀 PR: #42
👤 Autor: username
🌿 Rama: dev → test
🕐 Fecha: 2025-12-06 15:30:00

❌ Vulnerabilidades detectadas: 3

⚠️ El código NO puede ser mergeado hasta que se corrijan las vulnerabilidades.

Ver reporte: https://github.com/marinjosue/LiveChat/pull/42
```

### Ejemplo: Código Aprobado

```
✅ CÓDIGO APROBADO

📦 Repositorio: marinjosue/LiveChat
🔀 PR: #43
👤 Autor: username
🌿 Rama: dev → test
🕐 Fecha: 2025-12-06 16:00:00

✅ El análisis ML no detectó vulnerabilidades
✅ Todas las pruebas pasaron

🚀 El código está listo para merge
```

---

## 🚀 Proveedores de Despliegue Recomendados

### Opción 1: Railway (Recomendado)

```bash
# Instalar Railway CLI
npm install -g @railway/cli

# Login
railway login

# Crear proyecto
railway init

# Deploy
railway up
```

### Opción 2: Render

1. Conecta tu repositorio en [render.com](https://render.com)
2. Crea un nuevo Web Service
3. Selecciona Docker como runtime
4. Deploy automático en cada push a `main`

### Opción 3: Fly.io

```bash
# Instalar flyctl
curl -L https://fly.io/install.sh | sh

# Login
fly auth login

# Deploy
fly deploy
```

### Opción 4: Vercel (Solo Frontend)

```bash
# Instalar Vercel CLI
npm i -g vercel

# Deploy
cd cliente
vercel --prod
```

---

## 🔧 Troubleshooting

### Problema: Modelo no encontrado

**Error**: `FileNotFoundError: Modelo no encontrado`

**Solución**:
```bash
cd ml-security
python train_model.py
```

### Problema: Pipeline falla en GitHub Actions

**Verificar**:
1. Los secrets están configurados correctamente
2. El modelo está committeado (si es necesario)
3. Las dependencias están en `requirements.txt`

### Problema: Falsos positivos

**Solución**:
1. Revisar el código marcado como vulnerable
2. Si es un falso positivo, agregar más ejemplos de entrenamiento
3. Re-entrenar el modelo:
   ```bash
   cd ml-security
   python train_model.py
   ```

### Problema: No llegan notificaciones Telegram

**Verificar**:
1. El bot está creado correctamente
2. Has enviado un mensaje al bot (debe estar activo)
3. Los secrets `TELEGRAM_BOT_TOKEN` y `TELEGRAM_CHAT_ID` están configurados
4. El chat_id es correcto (número, no username)

---

## 📊 Métricas y Monitoreo

### Visualizar Reportes

Los reportes de seguridad se guardan como artifacts en GitHub Actions:

1. Ve a Actions → Security Pipeline
2. Selecciona un run
3. Descarga `security-report` en Artifacts

### Analizar Tendencias

```bash
# Ver historial de vulnerabilidades
gh run list --workflow=security-pipeline.yml --json conclusion,createdAt

# Ver issues de seguridad
gh issue list --label security
```

---

## 🔒 Mejores Prácticas

1. **Nunca hacer bypass** del pipeline de seguridad
2. **Revisar manualmente** las vulnerabilidades detectadas
3. **Actualizar el modelo** regularmente con nuevos patrones
4. **Monitorear falsos positivos** y ajustar el modelo
5. **Mantener secrets seguros** - nunca commitearlos
6. **Usar ramas protegidas** en GitHub
7. **Requerir reviews** antes de merge a `main`

---

## 📚 Referencias

- [scikit-learn Documentation](https://scikit-learn.org/)
- [OWASP Top 10](https://owasp.org/www-project-top-ten/)
- [GitHub Actions](https://docs.github.com/en/actions)
- [Docker Best Practices](https://docs.docker.com/develop/dev-best-practices/)

---

## 🤝 Contribución

Para mejorar el modelo:

1. Agregar más ejemplos en `train_model.py`
2. Ajustar características en `extract_code_features()`
3. Re-entrenar: `python train_model.py`
4. Validar con `python vulnerability_scanner.py`

---

## 📝 Licencia

Este pipeline es parte del proyecto LiveChat - ESPE 2025

---

## 🆘 Soporte

Para problemas o preguntas:
- 🐛 Issues: [GitHub Issues](https://github.com/marinjosue/LiveChat/issues)
- 📧 Email: [tu-email]
- 💬 Telegram: [@tu-username]

---

**¡Pipeline configurado exitosamente! 🎉**

Ahora tu código está protegido con IA antes de llegar a producción.
