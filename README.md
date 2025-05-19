# 💬 LiveChat

Plataforma para crear salas de chat en tiempo real mediante WebSockets, con control de acceso por PIN y límite de participantes.

## 🚀 Características

- Creación de salas con PIN único de 6 dígitos.
- Límite de participantes configurable.
- Comunicación en tiempo real con Socket.IO.
- Restricción por dispositivo usando almacenamiento local.
- Interfaz profesional y responsive con React y Lucide Icons.
- Mensajes de estado con PrimeReact Toast.

---

## 📦 Requisitos Previos

- [Node.js](https://nodejs.org) v14 o superior
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

### 1. Ejecutar el servidor (Backend)
```bash
npm start
```

### 2. En otra terminal, ejecutar el cliente (Frontend)
```bash
cd client
npm start
```

---

## 🌐 Acceso

Abre tu navegador en [http://localhost:3000](http://localhost:3000)

---

## 🛠️ Tecnologías Utilizadas

- **Node.js + Socket.IO** (Servidor)
- **React + PrimeReact + Lucide React** (Cliente)
- **CSS Grid + Flexbox + Animaciones** (Estilo)

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

## 📄 Licencia

Desarrollado por **Autepim**.

