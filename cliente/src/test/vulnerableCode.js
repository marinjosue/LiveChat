/**
 * Utilitarios de Prueba para LiveChat
 * Funciones auxiliares seguras para testing
 */

/**
 * Valida que un email tenga formato correcto
 * @param {string} email - Email a validar
 * @returns {boolean} - True si es válido
 */
function isValidEmail(email) {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
}

/**
 * Genera un PIN aleatorio para salas de chat
 * @returns {string} - PIN de 4 dígitos
 */
function generateRoomPIN() {
    return Math.floor(Math.random() * 9000 + 1000).toString();
}

/**
 * Sanitiza un string removiendo caracteres especiales
 * @param {string} text - Texto a sanitizar
 * @returns {string} - Texto sanitizado
 */
function sanitizeInput(text) {
    if (typeof text !== 'string') {
        return '';
    }
    return text.trim().replace(/[<>]/g, '');
}

/**
 * Valida la estructura de un usuario
 * @param {object} user - Objeto usuario
 * @returns {boolean} - True si es válido
 */
function isValidUser(user) {
    return (
        user &&
        typeof user === 'object' &&
        typeof user.id === 'string' &&
        typeof user.name === 'string' &&
        isValidEmail(user.email)
    );
}

/**
 * Crea un usuario con valores por defecto seguros
 * @param {object} userData - Datos del usuario
 * @returns {object} - Usuario creado
 */
function createUser(userData) {
    if (!isValidUser(userData)) {
        throw new Error('Datos de usuario inválidos');
    }
    
    return {
        id: userData.id,
        name: sanitizeInput(userData.name),
        email: userData.email.toLowerCase(),
        role: 'user',  // Siempre 'user', nunca del input
        createdAt: new Date(),
        isActive: true
    };
}

/**
 * Obtiene el estado de una sala de chat
 * @param {object} room - Objeto sala
 * @returns {object} - Estado de la sala
 */
function getRoomStatus(room) {
    if (!room) {
        return null;
    }
    
    return {
        id: room.id,
        name: room.name,
        memberCount: room.members ? room.members.length : 0,
        isActive: room.isActive || false,
        createdAt: room.createdAt
    };
}

/**
 * Formatea un mensaje para mostrar
 * @param {object} message - Mensaje a formatear
 * @returns {string} - Mensaje formateado
 */
function formatMessage(message) {
    if (!message || typeof message !== 'object') {
        return '';
    }
    
    const timestamp = new Date(message.timestamp).toLocaleTimeString();
    const sender = sanitizeInput(message.sender);
    const content = sanitizeInput(message.content);
    
    return `[${timestamp}] ${sender}: ${content}`;
}

/**
 * Valida que una contraseña cumple requisitos mínimos
 * @param {string} password - Contraseña a validar
 * @returns {boolean} - True si cumple requisitos
 */
function isStrongPassword(password) {
    if (!password || typeof password !== 'string') {
        return false;
    }
    
    return (
        password.length >= 8 &&
        /[A-Z]/.test(password) &&  // Al menos una mayúscula
        /[a-z]/.test(password) &&  // Al menos una minúscula
        /[0-9]/.test(password)     // Al menos un número
    );
}

/**
 * Obtiene información segura del usuario (sin datos sensibles)
 * @param {object} user - Usuario completo
 * @returns {object} - Información pública del usuario
 */
function getPublicUserInfo(user) {
    if (!user) {
        return null;
    }
    
    return {
        id: user.id,
        name: user.name,
        isActive: user.isActive
    };
}

/**
 * Calcula el tiempo desde un evento
 * @param {Date} date - Fecha del evento
 * @returns {string} - Tiempo transcurrido
 */
function getTimeAgo(date) {
    if (!date) {
        return 'Desconocido';
    }
    
    const now = new Date();
    const diffMs = now - new Date(date);
    const diffSecs = Math.floor(diffMs / 1000);
    const diffMins = Math.floor(diffSecs / 60);
    const diffHours = Math.floor(diffMins / 60);
    const diffDays = Math.floor(diffHours / 24);
    
    if (diffSecs < 60) return 'Hace unos segundos';
    if (diffMins < 60) return `Hace ${diffMins}m`;
    if (diffHours < 24) return `Hace ${diffHours}h`;
    return `Hace ${diffDays}d`;
}

/**
 * Valida que una URL es segura
 * @param {string} url - URL a validar
 * @returns {boolean} - True si es segura
 */
function isSafeURL(url) {
    if (!url || typeof url !== 'string') {
        return false;
    }
    
    try {
        const urlObj = new URL(url);
        return urlObj.protocol === 'http:' || urlObj.protocol === 'https:';
    } catch {
        return false;
    }
}

module.exports = {
    isValidEmail,
    generateRoomPIN,
    sanitizeInput,
    isValidUser,
    createUser,
    getRoomStatus,
    formatMessage,
    isStrongPassword,
    getPublicUserInfo,
    getTimeAgo,
    isSafeURL
};
