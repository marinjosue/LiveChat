// Correcta generación persistente del DeviceId
const getDeviceId = () => {
    let deviceId = sessionStorage.getItem('livechat-device-id');
    if (!deviceId) {
        deviceId = localStorage.getItem('livechat-device-id');
        if (!deviceId) {
            deviceId = 'device_' + Math.random().toString(36).substring(2, 15);
            localStorage.setItem('livechat-device-id', deviceId);
        }
        sessionStorage.setItem('livechat-device-id', deviceId);
    }
    return deviceId;
};

// Guardar información de la sala actual
const saveCurrentRoom = (roomData) => {
    const { pin, nickname, roomType } = roomData;
    const deviceId = getDeviceId();
    const roomInfo = { 
        pin, 
        nickname, 
        roomType: roomType || 'multimedia', // Por defecto multimedia si no se especifica
        deviceId, 
        lastActive: new Date().toISOString() 
    };
    console.log('💾 Guardando sala actual:', roomInfo);
    localStorage.setItem('livechat-current-room', JSON.stringify(roomInfo));
};

// Obtener información de la sala actual
const getCurrentRoom = () => {
    const roomData = localStorage.getItem('livechat-current-room');
    if (!roomData) return null;

    try {
        const parsedRoom = JSON.parse(roomData);
        // Verificar que los datos de la sala son válidos
        if (parsedRoom && parsedRoom.pin && parsedRoom.nickname) {
            // Actualizar la última actividad
            parsedRoom.lastActive = new Date().toISOString();
            localStorage.setItem('livechat-current-room', JSON.stringify(parsedRoom));
            return parsedRoom;
        }
        return null;
    } catch (error) {
        console.error("Error parsing room data:", error);
        return null;
    }
};

// Actualizar información de actividad en la sala
const updateRoomActivity = () => {
    const currentRoom = getCurrentRoom();
    if (currentRoom) {
        currentRoom.lastActive = new Date().toISOString();
        localStorage.setItem('livechat-current-room', JSON.stringify(currentRoom));
    }
};
const markPageRefreshing = (pin) => {
    const currentRoom = getCurrentRoom();
    if (currentRoom && currentRoom.pin === pin) {
        localStorage.setItem('livechat-refreshing', 'true');
        localStorage.setItem('livechat-refresh-timestamp', Date.now().toString());
        // Establecer expiración de 60 segundos para el estado de recarga
        setTimeout(() => {
            localStorage.removeItem('livechat-refreshing');
        }, 60000);
    }
};

// Limpiar información de la sala actual
const clearCurrentRoom = () => {
    localStorage.removeItem('livechat-current-room');
};

// Verificar si el usuario está marcado como "recargando página"
const isRefreshing = () => {
    return localStorage.getItem('livechat-refreshing') === 'true';
};

// Marcar que el usuario está recargando la página (no saliendo)
const setRefreshing = (isRefreshing) => {
    if (isRefreshing) {
        localStorage.setItem('livechat-refreshing', 'true');
    } else {
        localStorage.removeItem('livechat-refreshing');
    }
};
// Comprobar si estamos en proceso de recarga
const isReconnecting = () => {
    const refreshing = localStorage.getItem('livechat-refreshing') === 'true';
    const timestamp = localStorage.getItem('livechat-refresh-timestamp');
    
    // Si ha pasado más de 60 segundos, ya no estamos en recarga
    if (refreshing && timestamp) {
        const now = Date.now();
        const refreshTime = parseInt(timestamp, 10);
        if (now - refreshTime > 60000) {
            localStorage.removeItem('livechat-refreshing');
            localStorage.removeItem('livechat-refresh-timestamp');
            return false;
        }
        return true;
    }
    return false;
};

// Finalizar el proceso de reconexión
const finishReconnection = () => {
    localStorage.removeItem('livechat-refreshing');
    localStorage.removeItem('livechat-refresh-timestamp');
};

// Exportar los nuevos métodos
module.exports = {
    getDeviceId,
    saveCurrentRoom,
    getCurrentRoom,
    clearCurrentRoom,
    updateRoomActivity,
    isRefreshing,
    setRefreshing,
    markPageRefreshing,
    isReconnecting,
    finishReconnection
};
