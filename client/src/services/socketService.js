import { io } from "socket.io-client";

// Configuración de socket con opciones de reconexión
const socket = io("https://livechat-9oej.onrender.com", {
    reconnection: true,
    reconnectionAttempts: 10,
    reconnectionDelay: 1000,
    reconnectionDelayMax: 5000,
    timeout: 20000
});

console.log('Socket inicializado con opciones de reconexión:', socket);

export default socket;