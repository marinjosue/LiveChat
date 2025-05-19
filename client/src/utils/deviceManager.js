const DEVICE_ID_KEY = 'deviceId';
const CURRENT_ROOM_KEY = 'currentRoom';

// Genera o recupera un deviceId único
export const getDeviceId = () => {
    let deviceId = localStorage.getItem(DEVICE_ID_KEY);
    if (!deviceId) {
        deviceId = crypto.randomUUID();
        localStorage.setItem(DEVICE_ID_KEY, deviceId);
    }
    return deviceId;
};

// Guarda el estado actual de la sala
export const saveCurrentRoom = (pin, nickname) => {
    const roomData = { pin, nickname };
    localStorage.setItem(CURRENT_ROOM_KEY, JSON.stringify(roomData));
};

// Recupera el estado actual de la sala de forma segura
export const getCurrentRoom = () => {
    const saved = localStorage.getItem(CURRENT_ROOM_KEY);
    if (!saved) return null;

    try {
        const parsed = JSON.parse(saved);
        if (parsed && parsed.pin && parsed.nickname) {
            return parsed;
        } else {
            return null;
        }
    } catch (error) {
        console.error('Error leyendo el estado de la sala desde localStorage:', error);
        return null;
    }
};

// Limpia el estado guardado
export const clearCurrentRoom = () => {
    localStorage.removeItem(CURRENT_ROOM_KEY);
};
