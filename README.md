# 💬 LiveChat

Plataforma para crear salas de chat en tiempo real mediante WebSockets, con control de acceso por PIN y límite de participantes.

## 🚀 Características

### Funcionalidades del Chat:
- ✅ Creación de salas con PIN único de 6 dígitos
- ✅ Límite de participantes configurable por sala  
- ✅ Comunicación en tiempo real con Socket.IO
- ✅ Restricción por dispositivo usando almacenamiento local
- ✅ Interfaz profesional y responsive con React
- ✅ Mensajes de estado con PrimeReact Toast
- ✅ Iconografía moderna con Lucide Icons

### Características de Producción:
- 🐳 **Containerizado con Docker** para fácil despliegue
- 🔒 **Configuración de seguridad** con headers HTTP seguros
- 🚀 **Multi-stage builds** para optimización de imágenes
- 💾 **Persistencia de datos** con MongoDB
- 🏥 **Health checks** integrados para monitoreo
- 🌐 **Nginx optimizado** con compresión gzip y cache
- 📊 **Logs estructurados** para debugging y monitoring

---

## 📦 Requisitos Previos

### Para ejecución con Docker:
- [Docker](https://www.docker.com/get-started) 
- [Docker Compose](https://docs.docker.com/compose/install/)

### Para ejecución local:
- [Node.js](https://nodejs.org) v18 o superior
- [MongoDB](https://www.mongodb.com/try/download/community) (local)
- [Git](https://git-scm.com)

---

## ⚙️ Instalación

1. Clona el repositorio:

2. Instala las dependencias del servidor:
   ```bash
   npm install
   ```

3. Instala las dependencias del cliente:
   ```bash
   cd client
   npm install
   ```

4. Vuelve a la raíz del proyecto:
   ```bash
   cd ..
   ```

---

## ▶️ Ejecución del Proyecto

### Opción 1: Ejecución con Docker (Recomendado)

#### 🐳 Con Docker Compose (Aplicación Completa)
```bash
# Desde el directorio server/
cd server
docker-compose up -d
```

#### 🔧 Construcción Individual de Contenedores

**Cliente (Frontend):**
```bash
cd client
docker build -t livechat-client .
docker run -d --name livechat-client-container -p 3000:80 livechat-client
```

**Servidor (Backend):**
```bash
cd server
docker build -t livechat-server .
docker run -d --name livechat-server-container -p 3001:3001 livechat-server
```

### Opción 2: Ejecución Local (Desarrollo)

#### 1. Ejecutar el servidor (Backend)
```bash
npm start
```

#### 2. En otra terminal, ejecutar el cliente (Frontend)
```bash
cd client
npm start
```

---

## 🌐 Acceso

### Con Docker:
- **Frontend:** [http://localhost:3000](http://localhost:3000)
- **Backend:** [http://localhost:3001](http://localhost:3001)
- **MongoDB:** `localhost:27017`

### Con ejecución local:
- **Frontend:** [http://localhost:3000](http://localhost:3000)
- **Backend:** [http://localhost:3001](http://localhost:3001)

---

## 🛠️ Tecnologías Utilizadas

### Backend:
- **Node.js 18-alpine** (Servidor)
- **Socket.IO** (WebSockets en tiempo real)
- **MongoDB** (Base de datos)
- **Docker** (Contenedorización)

### Frontend:
- **React 19** (Framework frontend)
- **PrimeReact + PrimeIcons** (Componentes UI)
- **Lucide React** (Iconografía)
- **Nginx Alpine** (Servidor web de producción)
- **CSS Grid + Flexbox + Animaciones** (Estilo)

### DevOps:
- **Docker & Docker Compose** (Contenedorización y orquestación)
- **Multi-stage builds** (Optimización de imágenes)
- **Health checks** (Monitoreo de contenedores)

---

### 📦 Instalación de Librerías Adicionales

#### Frontend (React)

Ejecuta estos comandos dentro del directorio `client`:

```bash
npm install primereact primeicons
npm install lucide-react
```

Estas librerías son necesarias para:
- **PrimeReact y PrimeIcons:** Componentes UI como botones, inputs y notificaciones.
- **Lucide React:** Iconografía profesional.

#### Backend (Node.js)

Ejecuta estos comandos en la raíz del proyecto:

```bash
npm install socket.io
npm install dotenv
```

Estas librerías son necesarias para:
- **Socket.IO:** Comunicación en tiempo real entre cliente y servidor.
- **Dotenv:** Manejo de variables de entorno en el servidor.

---

## 🐳 Comandos Docker Útiles

### Gestión de Contenedores
```bash
# Ver contenedores en ejecución
docker ps

# Ver logs del cliente
docker logs livechat-client-container

# Ver logs del servidor
docker logs livechat-server-container

# Parar contenedores
docker stop livechat-client-container livechat-server-container

# Eliminar contenedores
docker rm livechat-client-container livechat-server-container

# Eliminar imágenes
docker rmi livechat-client livechat-server
```

### Docker Compose
```bash
# Ejecutar en background
docker-compose up -d

# Ver logs en tiempo real
docker-compose logs -f

# Parar servicios
docker-compose down

# Reconstruir imágenes
docker-compose up --build

# Limpiar volúmenes
docker-compose down -v
```

### Health Checks
```bash
# Verificar salud del cliente
curl http://localhost:3000/health

# Verificar salud del servidor
curl http://localhost:3001/health
```

---

## ⚙️ Configuración Avanzada

### Variables de Entorno

**Cliente (`client/.env`):**
```env
REACT_APP_SOCKET_URL=http://localhost:3001
GENERATE_SOURCEMAP=false
```

**Servidor (`server/.env`):**
```env
PORT=3001
MONGODB_URI=mongodb://localhost:27017/livechat
FRONTEND_URL=http://localhost:3000
```

### Personalización del Build
```bash
# Cliente con URL personalizada del socket
docker build --build-arg REACT_APP_SOCKET_URL=http://mi-servidor:3001 -t livechat-client .

# Servidor con puerto personalizado
docker run -d -p 4001:4001 -e PORT=4001 livechat-server
```

---

## 📄 Licencia

Desarrollado por **Autepim**.

