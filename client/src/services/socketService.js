import io from 'socket.io-client';
import { getDeviceId, setRefreshing } from '../utils/deviceManager';

// 🔐 CONFIGURACIÓN HTTPS CON FALLBACK A HTTP
const getSocketURL = () => {
  const httpsUrl = process.env.REACT_APP_SOCKET_URL || 'https://localhost:3001';
  // Intentar HTTPS primero, fallback a HTTP si falla
  return httpsUrl;
};

// Configuración para reconexión automática con TLS/SSL
const socket = io(getSocketURL(), {
    reconnection: true,
    reconnectionAttempts: 5,
    reconnectionDelay: 1000,
    reconnectionDelayMax: 5000,
    timeout: 20000,
    secure: true, // Usar conexión segura
    rejectUnauthorized: false, // Para certificados autofirmados en desarrollo
    auth: {
        deviceId: getDeviceId() // Incluir deviceId en la conexión
    }
});

let reconnectTimer = null;

// Manejar eventos de conexión
socket.on('connect', () => {
    console.log('Conectado al servidor de socket');
    setRefreshing(false); // Limpiar el estado de recarga cuando conectamos
    const currentRoom = JSON.parse(localStorage.getItem('livechat-current-room'));
    if (currentRoom) {
        socket.auth = { 
            deviceId: getDeviceId(),
            roomPin: currentRoom.pin 
        };
    }
});

// Manejar eventos de desconexión
socket.on('disconnect', (reason) => {
    console.log('Desconectado del servidor de socket:', reason);
    if (reason === 'io client disconnect') {
        // Desconexión voluntaria, no hacer nada
    } else {
        // Intentar reconectar
        console.log('Intentando reconectar...');
    }
    if (reason === 'io server disconnect') {
        // Desconexión desde el servidor
        socket.connect();
    }
});

// Manejar evento de reconexión
socket.on('reconnect', (attemptNumber) => {
    console.log(`Reconectado al servidor después de ${attemptNumber} intentos`);
});

// Manejar error de reconexión
socket.on('reconnect_error', (error) => {
    console.error('Error al reconectar:', error);
});

// Manejar error de reconexión fallida
socket.on('reconnect_failed', () => {
    console.error('Reconexión fallida después de múltiples intentos');
});

socket.on('connect_error', (error) => {
    console.log('Error de conexión:', error);
    if (!reconnectTimer) {
        reconnectTimer = setTimeout(() => {
            socket.connect();
            reconnectTimer = null;
        }, 1000);
    }
});

// Interceptar el evento de beforeunload para notificar al servidor
if (typeof window !== 'undefined') {
    window.addEventListener('beforeunload', () => {
        const currentRoom = JSON.parse(localStorage.getItem('livechat-current-room'));
        if (currentRoom && currentRoom.pin) {
            setRefreshing(true);
            socket.emit('pageRefreshing', {
                pin: currentRoom.pin,
                deviceId: getDeviceId()
            });
        }
        if (reconnectTimer) {
            clearTimeout(reconnectTimer);
        }
    });
}

export default socket;