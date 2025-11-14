# 💬 LiveChat

Aplicación web de chat en tiempo real que permite crear y unirse a salas de conversación privadas mediante un sistema de PIN único. Ideal para reuniones rápidas, clases virtuales, soporte técnico o cualquier escenario que requiera comunicación instantánea grupal.

---

## 📋 ¿Qué es LiveChat?

LiveChat es una plataforma de mensajería instantánea que permite:

- **Crear salas de chat** con un PIN único de 6 dígitos
- **Unirse a salas existentes** usando el PIN
- **Limitar participantes** por sala (configurable al crear)
- **Chat en tiempo real** mediante WebSockets (Socket.IO)
- **Control de dispositivos** - un dispositivo solo puede estar en una sala a la vez
- **Interfaz moderna y responsive** optimizada para cualquier dispositivo

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

---

## 🚀 Inicio Rápido

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
│   │   │   └── JoinRoom.js
│   │   ├── services/          # Socket.IO client
│   │   ├── styles/            # Estilos CSS
│   │   └── utils/             # Utilidades
│   ├── Dockerfile             # Producción (Nginx)
│   ├── Dockerfile.dev         # Desarrollo (hot-reload)
│   ├── nginx.conf             # Config Nginx
│   └── package.json
├── server/                    # Backend Node.js
│   ├── controllers/           # Lógica de negocio
│   │   ├── DeviceSessionController.js
│   │   └── RoomController.js
│   ├── models/                # Modelos MongoDB
│   │   ├── DeviceSession.js
│   │   ├── Message.js
│   │   └── Room.js
│   ├── utils/                 # Utilidades
│   ├── Dockerfile             # Producción
│   ├── Dockerfile.dev         # Desarrollo (nodemon)
│   ├── server.js              # Punto de entrada
│   └── package.json
├── docker-compose.yml         # Configuración producción
├── docker-compose.dev.yml     # Configuración desarrollo
├── start-dev.ps1             # Script helper desarrollo
├── start-prod.ps1            # Script helper producción
├── .gitignore
└── README.md                 # Este archivo
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

