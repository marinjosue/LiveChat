// Correcta generación persistente del DeviceId
const getDeviceId = () => {
    // Primero intentar obtener de la sesión actual
    let deviceId = sessionStorage.getItem('livechat-device-id');
    if (!deviceId) {
        // Si no existe en sesión, buscar en localStorage
        deviceId = localStorage.getItem('livechat-device-id');
        if (!deviceId) {
            // Solo generar nuevo si no existe en ningún lado
            deviceId = 'device_' + Math.random().toString(36).substring(2, 15);
            localStorage.setItem('livechat-device-id', deviceId);
        }
        // Guardar en sesión para mantener consistencia durante recargas
        sessionStorage.setItem('livechat-device-id', deviceId);
    }
    return deviceId;
};

// Guardar información de la sala actual
const saveCurrentRoom = (roomData) => {
    const { pin, nickname } = roomData;
    const deviceId = getDeviceId();
    const roomInfo = { pin, nickname, deviceId, lastActive: new Date().toISOString() };
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

module.exports = {
    getDeviceId,
    saveCurrentRoom,
    getCurrentRoom,
    clearCurrentRoom,
    updateRoomActivity,
    isRefreshing,
    setRefreshing
};
