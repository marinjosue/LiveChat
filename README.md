# 🛡️ LiveChat - Secure Edition

Sistema de chat en tiempo real con salas seguras, autenticación de administradores y múltiples características de seguridad.

## ✨ Características Principales

### 🔐 Seguridad
- **PIN Hasheado (SHA-256)**: Los PINs de sala nunca se almacenan en texto plano
- **ID Único Encriptado**: Cada sala tiene un identificador único de 16 caracteres hexadecimales
- **Autenticación JWT**: Tokens seguros con expiración de 24 horas
- **2FA Opcional**: Autenticación de dos factores con TOTP (Google Authenticator)
- **Detección de Esteganografía**: 5 técnicas de análisis para archivos multimedia
- **Encriptación AES-256-GCM**: Mensajes encriptados en tránsito
- **Rate Limiting**: Protección contra ataques DDoS
- **Helmet**: Headers HTTP seguros
- **Audit Logging**: Logs con hash SHA-256 para no repudio

### 🏠 Gestión de Salas
- **Creación por Admin**: Solo administradores pueden crear salas
- **Tipos de Sala**: Texto (solo mensajes) o Multimedia (archivos, imágenes, videos)
- **Persistencia**: Salas y mensajes guardados en MongoDB
- **Límite de Participantes**: 2-10 usuarios por sala
- **Auto-Expiración**: Salas vacías se eliminan automáticamente después de 1 hora
- **Gestión desde Panel Admin**: Ver, crear y eliminar salas

### 💬 Chat en Tiempo Real
- **Socket.IO**: Comunicación bidireccional en tiempo real
- **Mensajes Persistentes**: Historial completo al unirse/reconectar
- **Archivos Multimedia**: Soporte para imágenes, videos, audio y documentos
- **Cloudinary**: Almacenamiento CDN para archivos
- **Validación de Archivos**: Límite de 15MB, tipos permitidos configurables
- **Reconexión Automática**: Sesión persistente al recargar página

### ⚡ Concurrencia y Rendimiento
- **Worker Thread Pool**: Procesamiento paralelo de autenticación
- **Thread Pool Manager**: Auto-escalado de workers (2-8)
- **File Analysis Workers**: Análisis de archivos en threads separados
- **Lock Management**: Prevención de deadlocks
- **Métricas en Tiempo Real**: Estadísticas de utilización de workers

---

## 🏗️ Arquitectura

```
┌─────────────────────────────────────────────┐
│              LIVECHAT APP                   │
├─────────────────────────────────────────────┤
│                                             │
│  ┌──────────────┐      ┌──────────────┐   │
│  │   CLIENT     │◄────►│   SERVER     │   │
│  │              │      │              │   │
│  │ React + Nginx│      │ Node.js +    │   │
│  │   (Port 80)  │      │  Socket.IO   │   │
│  │              │      │  (Port 3001) │   │
│  └──────────────┘      └───────┬──────┘   │
│                                │           │
│                                ▼           │
│                        ┌──────────────┐   │
│                        │   MongoDB    │   │
│                        │ (Port 27017) │   │
│                        └──────────────┘   │
└─────────────────────────────────────────────┘
```

---

## 🚀 Características

### Funcionalidades del Chat
- ✅ Sistema de salas con PIN único de 6 dígitos
- ✅ Límite de participantes configurable (2-10 personas)
- ✅ Mensajería instantánea con Socket.IO
- ✅ Control de dispositivo único por sala
- ✅ Lista de participantes en tiempo real
- ✅ Notificaciones de entrada/salida
- ✅ Interfaz intuitiva y responsive

### Características Técnicas
- 🐳 **100% Dockerizado** - un comando para ejecutar todo
- 🔒 **Seguridad** - Headers HTTP seguros, CORS configurado
- 🚀 **Optimizado** - Multi-stage builds, imágenes Alpine
- 💾 **Persistencia** - Datos guardados en MongoDB
- 🏥 **Health Checks** - Monitoreo automático de servicios
- 🌐 **Nginx** - Servidor web optimizado con gzip y caché
- 📊 **Logs** - Sistema de logging estructurado

---

## 🛠️ Stack Tecnológico

### Frontend
- **React 19** - Framework de UI
- **Socket.IO Client** - WebSockets
- **PrimeReact** - Componentes UI
- **Lucide Icons** - Iconografía moderna
- **Nginx** - Servidor web de producción

### Backend
- **Node.js 18** - Runtime
- **Express** - Framework web
- **Socket.IO** - Comunicación en tiempo real
- **MongoDB** - Base de datos NoSQL
- **Mongoose** - ODM para MongoDB

### DevOps
- **Docker** - Contenedorización
- **Docker Compose** - Orquestación
- **Multi-stage builds** - Optimización

---

## 📦 Requisitos

- **Docker** y **Docker Compose** (recomendado)
- O alternativamente: **Node.js 18+** y **MongoDB** para ejecución local
- **Cuenta de Cloudinary** (para almacenamiento de archivos multimedia)

---

## 🚀 Inicio Rápido

### ⚙️ Configuración Inicial de Seguridad

**IMPORTANTE: Antes de iniciar el servidor, debes configurar las credenciales de seguridad.**

```bash
# 1. Ir al directorio del servidor
cd server

# 2. Instalar dependencias
npm install

# 3. Generar claves de encriptación
node scripts/generateEncryptionKey.js

# 4. Copiar .env.example a .env
cp .env.example .env

# 5. Editar .env con las claves generadas y tu configuración
# - Pegar las claves generadas en el paso 3
# - Agregar credenciales de MongoDB
# - Agregar credenciales de Cloudinary

# 6. Crear el primer administrador
node scripts/createAdmin.js
# Sigue las instrucciones interactivas

# Ahora estás listo para iniciar el servidor
```

### 🔧 Modo Desarrollo (con Hot-Reload)

**Ideal para desarrollo** - Los cambios en el código se reflejan automáticamente sin reconstruir contenedores.

```bash
# 1. Clonar el repositorio
git clone <tu-repo>
cd LiveChat

# 2. Iniciar en modo desarrollo
docker-compose -f docker-compose.dev.yml up --build

# 3. Acceder a la aplicación
# Frontend: http://localhost:3000 (hot-reload automático)
# Backend: http://localhost:3001 (nodemon)
# MongoDB: localhost:27017
```

**✨ Los cambios se aplican automáticamente:**
- Edita archivos en `client/src/` → El navegador se recarga solo
- Edita archivos en `server/` → Nodemon reinicia el servidor automáticamente

**Scripts helper (Windows):**
```powershell
.\start-dev.ps1
```

---

### 🚀 Modo Producción

**Para despliegue en servidores** - Build optimizado con Nginx.

```bash
# 1. Iniciar en modo producción
docker-compose up --build

# 2. Acceder a la aplicación
# Frontend: http://localhost (puerto 80)
# Backend: http://localhost:3001
# MongoDB: localhost:27017
```

**Scripts helper (Windows):**
```powershell
.\start-prod.ps1
```

---

### 💻 Desarrollo Local (sin Docker)

**Si prefieres no usar Docker:**

```bash
# Terminal 1 - MongoDB
mongod

# Terminal 2 - Backend
cd server
npm install
npm run dev

# Terminal 3 - Frontend
cd client
npm install
npm start

# Acceder a http://localhost:3000
```

---

## 🔧 Comandos Útiles

### Desarrollo

```bash
# Iniciar desarrollo
docker-compose -f docker-compose.dev.yml up

# Ver logs en tiempo real
docker-compose -f docker-compose.dev.yml logs -f

# Ver logs solo del servidor
docker-compose -f docker-compose.dev.yml logs -f server

# Ver logs solo del cliente
docker-compose -f docker-compose.dev.yml logs -f client

# Reiniciar un servicio
docker-compose -f docker-compose.dev.yml restart server

# Detener todo
docker-compose -f docker-compose.dev.yml down

# Resetear base de datos
docker-compose -f docker-compose.dev.yml down -v
```

### Producción

```bash
# Iniciar producción
docker-compose up -d

# Ver logs
docker-compose logs -f

# Detener
docker-compose down

# Actualizar servicios
docker-compose up -d --build
```

---

## 🎮 Cómo Usar la Aplicación

### 1. Crear una Sala
- Ingresa un nombre de sala
- Define el límite de participantes (2-10)
- Se generará un PIN de 6 dígitos automáticamente
- Comparte el PIN con otros usuarios

### 2. Unirse a una Sala
- Ingresa el PIN de 6 dígitos de la sala
- Serás conectado automáticamente si hay espacio

### 3. Chatear
- Escribe mensajes en tiempo real
- Ve la lista de participantes activos
- Recibe notificaciones de entradas/salidas

---

## ⚙️ Configuración Avanzada

### Variables de Entorno

#### Desarrollo (`docker-compose.dev.yml`)
```yaml
server:
  environment:
    - MONGODB_URI=mongodb://mongodb:27017/livechat
    - PORT=3001
    - FRONTEND_URL=http://localhost:3000
    - NODE_ENV=development

client:
  environment:
    - REACT_APP_SOCKET_URL=http://localhost:3001
```

#### Producción (`docker-compose.yml`)
```yaml
server:
  environment:
    - MONGODB_URI=mongodb://mongodb:27017/livechat
    - PORT=3001
    - FRONTEND_URL=http://tu-dominio.com
    - NODE_ENV=production

client:
  build:
    args:
      - REACT_APP_SOCKET_URL=http://tu-dominio.com:3001
```

---

## 🚀 Despliegue en Producción

### Opción 1: VPS (AWS EC2, DigitalOcean, etc.)

```bash
# 1. Conectar al servidor
ssh usuario@tu-servidor-ip

# 2. Instalar Docker
sudo apt update
sudo apt install -y docker.io docker-compose

# 3. Clonar repositorio
git clone <tu-repo>
cd LiveChat

# 4. Configurar variables de entorno
# Edita docker-compose.yml con tus URLs

# 5. Iniciar servicios
docker-compose up -d

# 6. Ver logs
docker-compose logs -f
```

### Opción 2: Docker Hub

```bash
# 1. Build de imágenes
docker build -t tu-usuario/livechat-client:latest ./client
docker build -t tu-usuario/livechat-server:latest ./server

# 2. Push a Docker Hub
docker push tu-usuario/livechat-client:latest
docker push tu-usuario/livechat-server:latest

# 3. En el servidor, pull y ejecutar
docker pull tu-usuario/livechat-client:latest
docker pull tu-usuario/livechat-server:latest
docker-compose up -d
```

### Opción 3: Cloud Platforms

#### AWS (ECS/Fargate)
- Sube las imágenes a ECR
- Crea un Task Definition
- Despliega en ECS/Fargate

#### Azure (Container Instances)
```bash
az container create \
  --resource-group mi-grupo \
  --name livechat \
  --image tu-usuario/livechat-client:latest
```

#### Google Cloud (Cloud Run)
```bash
gcloud run deploy livechat \
  --image gcr.io/tu-proyecto/livechat-client \
  --platform managed
```

---

## 🔒 Recomendaciones de Seguridad (Producción)

### 1. SSL/TLS (HTTPS)

```bash
# Instalar Certbot
sudo apt install certbot python3-certbot-nginx
sudo certbot --nginx -d tudominio.com
```

### 2. Firewall

```bash
# Configurar UFW
sudo ufw allow 22/tcp
sudo ufw allow 80/tcp
sudo ufw allow 443/tcp
sudo ufw enable
```

### 3. Variables Sensibles

```bash
# Usar secrets de Docker
echo "mongodb://user:pass@host:27017/db" | docker secret create mongo_uri -
```

### 4. Actualizar Regularmente

```bash
# Actualizar imágenes
docker-compose pull
docker-compose up -d
```

---

## 🐛 Troubleshooting

### Los cambios no se reflejan (Desarrollo)

```bash
# Verifica que uses docker-compose.dev.yml
docker-compose -f docker-compose.dev.yml restart
```

### Puerto ya en uso

```bash
# Ver qué usa el puerto
netstat -ano | findstr :3000

# Matar proceso (Windows)
taskkill /PID <PID> /F
```

### Error de build

```bash
# Limpiar todo
docker-compose -f docker-compose.dev.yml down -v
docker system prune -f
docker-compose -f docker-compose.dev.yml up --build
```

### Base de datos con datos incorrectos

```bash
# Resetear MongoDB
docker-compose -f docker-compose.dev.yml down -v
docker-compose -f docker-compose.dev.yml up
```

### Frontend no se conecta al backend

1. Verifica `REACT_APP_SOCKET_URL` en el build
2. Verifica CORS en el backend
3. Reconstruye el cliente:
```bash
docker-compose build client
docker-compose up -d client
```

---


## 📂 Estructura del Proyecto

```
LiveChat/
├── client/                    # Frontend React
│   ├── src/
│   │   ├── components/        # Componentes React
│   │   │   ├── ChatRoom.js
│   │   │   ├── CreateRoom.js
│   │   │   ├── JoinRoom.js
│   │   │   ├── AdminLogin.js      # 🆕 Login de admin con 2FA
│   │   │   └── AdminDashboard.js   # 🆕 Panel de administración
│   │   ├── services/          # Socket.IO client
│   │   ├── styles/            # Estilos CSS
│   │   │   ├── AdminLogin.css     # 🆕
│   │   │   └── AdminDashboard.css  # 🆕
│   │   ├── utils/             # Utilidades
│   │   ├── AdminApp.js        # 🆕 App de administración
│   │   └── App.js
│   ├── Dockerfile             # Producción (Nginx)
│   ├── Dockerfile.dev         # Desarrollo (hot-reload)
│   ├── nginx.conf             # Config Nginx
│   └── package.json
├── server/                    # Backend Node.js
│   ├── controllers/           # Lógica de negocio
│   │   ├── DeviceSessionController.js
│   │   ├── RoomController.js
│   │   └── AuthController.js      # 🆕 Autenticación de admins
│   ├── models/                # Modelos MongoDB
│   │   ├── DeviceSession.js
│   │   ├── Message.js         # ✨ Extendido con encriptación
│   │   ├── Room.js            # ✨ Extendido con tipos y seguridad
│   │   ├── Admin.js           # 🆕 Modelo de administrador
│   │   └── AuditLog.js        # 🆕 Logs de auditoría
│   ├── services/              # 🆕 Servicios de seguridad
│   │   ├── auditService.js        # Winston logging
│   │   ├── encryptionService.js   # AES-256-GCM
│   │   ├── fileSecurityService.js # Validación de archivos
│   │   ├── threadPoolManager.js   # Gestión de concurrencia
│   │   └── workerPoolService.js   # Pools de workers
│   ├── workers/               # 🆕 Worker Threads
│   │   ├── hashWorker.js          # Hash de contraseñas
│   │   ├── verifyWorker.js        # Verificación bcrypt
│   │   ├── integrityWorker.js     # Hashes SHA
│   │   └── steganographyWorker.js # Detección de esteganografía
│   ├── middleware/            # 🆕 Middleware de seguridad
│   │   └── security.js            # Helmet, rate limiting, etc.
│   ├── routes/                # 🆕 Rutas de API
│   │   ├── auth.js                # Autenticación
│   │   └── admin.js               # Panel de administración
│   ├── scripts/               # 🆕 Scripts de utilidad
│   │   ├── createAdmin.js         # Crear administrador
│   │   └── generateEncryptionKey.js # Generar claves
│   ├── config/
│   │   └── cloudinary.js
│   ├── utils/                 # Utilidades
│   ├── Dockerfile             # Producción
│   ├── Dockerfile.dev         # Desarrollo (nodemon)
│   ├── server.js              # ✨ Punto de entrada (refactorizado)
│   ├── .env.example           # 🆕 Template de configuración
│   └── package.json           # ✨ Nuevas dependencias
├── docker-compose.yml         # Configuración producción
├── docker-compose.dev.yml     # Configuración desarrollo
├── SECURITY_IMPLEMENTATION.md # 🆕 Documentación de seguridad
├── start-dev.ps1             # Script helper desarrollo
├── start-prod.ps1            # Script helper producción
├── .gitignore
└── README.md                 # Este archivo

🆕 = Nuevo archivo
✨ = Archivo modificado con nuevas funcionalidades
```

---

## 🔄 Flujo de Trabajo Típico

### Desarrollo Diario

```bash
# Lunes - Primera vez
docker-compose -f docker-compose.dev.yml up --build

# Martes a Viernes
docker-compose -f docker-compose.dev.yml up

# Editas código → Hot-reload automático ✨

# Al terminar el día
docker-compose -f docker-compose.dev.yml down
```

### Agregar Nueva Característica

```bash
# 1. Crear rama
git checkout -b feature/nueva-caracteristica

# 2. Iniciar desarrollo
docker-compose -f docker-compose.dev.yml up

# 3. Desarrollar (cambios automáticos)

# 4. Probar

# 5. Commit
git add .
git commit -m "feat: nueva característica"
git push origin feature/nueva-caracteristica
```

### Preparar para Producción

```bash
# 1. Probar build de producción localmente
docker-compose up --build

# 2. Verificar en http://localhost

# 3. Si todo funciona, hacer deploy
```

---

## 🔒 Panel de Administración

### Acceso
Para acceder al panel de administración, integra `AdminApp.js` en tu enrutador principal:

```jsx
import React from 'react';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import App from './App'; // Tu app normal de chat
import AdminApp from './AdminApp'; // Panel de admin

function Root() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<App />} />
        <Route path="/admin" element={<AdminApp />} />
      </Routes>
    </BrowserRouter>
  );
}

export default Root;
```

### Funcionalidades del Panel

#### 📊 Overview
- Métricas del servidor (uptime, memoria, CPU)
- Estado de los Worker Thread pools
- Utilización de workers globales, auth y file security
- Rendimiento (tiempo de espera, ejecución, pico de cola)

#### 📋 Logs de Auditoría
- Últimos 10 logs con actualización automática cada 10s
- Filtrado por admin, acción, estado, fecha
- Información detallada: IP, User-Agent, timestamp

#### 🔒 Estado de Seguridad
- Verificación de funcionalidades activas
- Información de configuración de seguridad
- Alertas de configuraciones pendientes

### Autenticación 2FA

1. **Login inicial**: Usuario + contraseña
2. **Habilitar 2FA** (opcional):
   ```bash
   POST /api/auth/enable-2fa
   Authorization: Bearer <token>
   ```
   Retorna un QR code para Google Authenticator
3. **Login con 2FA**: Ingresa código de 6 dígitos

---

## 🔐 API de Administración

### Endpoints de Autenticación

```bash
# Registrar nuevo admin
POST /api/auth/register
Content-Type: application/json
{
  "username": "admin",
  "email": "admin@example.com",
  "password": "StrongPass123!",
  "role": "superadmin"
}

# Login
POST /api/auth/login
{
  "username": "admin",
  "password": "StrongPass123!"
}
# Retorna: { requires2FA: true, tempToken: "..." } O { token: "..." }

# Verificar código 2FA
POST /api/auth/verify-2fa
{
  "tempToken": "...",
  "code": "123456"
}

# Habilitar 2FA
POST /api/auth/enable-2fa
Authorization: Bearer <token>
# Retorna: { qrCode: "data:image/png;base64,...", secret: "..." }
```

### Endpoints de Administración

```bash
# Obtener logs de auditoría (paginado)
GET /api/admin/logs?page=1&limit=20&action=LOGIN_SUCCESS&status=success
Authorization: Bearer <token>

# Verificar integridad de logs
POST /api/admin/logs/verify-integrity
Authorization: Bearer <token>
{
  "logIds": ["log_id_1", "log_id_2"]
}

# Obtener estadísticas del sistema
GET /api/admin/stats
Authorization: Bearer <token>

# Health check con stats de thread pools
GET /health
```

---

## 🔍 Seguridad en Detalle

### 1. Encriptación de Mensajes (AES-256-GCM)

Los mensajes sensibles se encriptan antes de almacenarse:

```javascript
// En el servidor
const EncryptionService = require('./services/encryptionService');
const encrypted = EncryptionService.encryptMessage('Mensaje secreto');
// { encrypted, iv, salt, authTag }

// Para desencriptar
const decrypted = EncryptionService.decryptMessage(encrypted, iv, salt, authTag);
```

### 2. Detección de Esteganografía

Archivos multimedia pasan por 5 análisis:

1. **Entropía**: Detecta datos comprimidos ocultos (threshold: 7.8 bits/byte)
2. **LSB Analysis**: Analiza patrones en Least Significant Bits
3. **Firmas Conocidas**: Detecta herramientas como Steghide, OpenStego
4. **Chi-cuadrado**: Anomalías en distribución de bytes
5. **Análisis de Imagen**: Metadatos excesivos, canales sospechosos

```bash
# Configurar threshold de rechazo (en .env)
STEGANOGRAPHY_CONFIDENCE_THRESHOLD=0.7  # 0-1, default 0.7
```

### 3. Gestión de Concurrencia

```javascript
// Worker Threads automáticos
const threadPool = require('./services/threadPoolManager');

// Ejecutar tarea CPU-intensiva
const result = await threadPool.enqueueTask(
  { operation: 'hash', data: password },
  'high' // priority: low, normal, high
);
```

### 4. Logs de Auditoría

Todas las acciones administrativas se registran:

```javascript
const auditService = require('./services/auditService');

// Registrar acción
await auditService.logLoginSuccess(adminId, ipAddress, userAgent);

// Verificar integridad
const isValid = await auditLog.verifyIntegrity();
```

---

## 🛡️ Checklist de Seguridad para Producción

- [ ] **SSL/TLS**: Certificado instalado (Let's Encrypt recomendado)
- [ ] **Firewall**: Solo puertos 80, 443 abiertos
- [ ] **Variables de entorno**: Claves generadas con `generateEncryptionKey.js`
- [ ] **MongoDB**: Autenticación habilitada, usuario con permisos limitados
- [ ] **Backups**: Configurar backups automáticos de MongoDB
- [ ] **Logs**: Rotar logs con logrotate o similar
- [ ] **Rate Limiting**: Configurado en `.env` según tu tráfico
- [ ] **2FA**: Habilitado para todos los administradores
- [ ] **Monitoreo**: Configurar alertas para errores críticos
- [ ] **Actualización**: Proceso para actualizar dependencias regularmente

---

## 📚 Documentación Adicional

- **[SECURITY_IMPLEMENTATION.md](./SECURITY_IMPLEMENTATION.md)** - Guía detallada de implementación de seguridad
- **Logs de Auditoría**: Ver `server/logs/` para archivos de log
- **Ejemplos de API**: Importar colección de Postman (crear según necesidad)

---

## 💡 Tips Importantes

1. **Desarrollo**: Siempre usa `docker-compose.dev.yml`
2. **Producción**: Usa `docker-compose.yml`
3. **Hot-reload**: Los cambios se aplican solos, ¡no rebuilds!
4. **Dependencias**: Solo rebuild si cambias `package.json`
5. **Logs**: Usa `logs -f` para ver errores en tiempo real
6. **Git**: No commitees `node_modules/` ni `.env`

---

## 📄 Licencia

Este proyecto está desarrollado por **Autepim**.

---

**Desarrollado con ❤️ por Autepim**

