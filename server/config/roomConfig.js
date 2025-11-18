/**
 * Configuración centralizada para salas de chat
 * Define límites, tipos de sala y validaciones
 */

const ROOM_LIMITS = {
  NAME_MAX_LENGTH: 30,
  NAME_MIN_LENGTH: 3,
  MIN_PARTICIPANTS: 2,
  MAX_PARTICIPANTS: 50,
  MAX_ACTIVE_ROOMS: 15
};

const ROOM_TYPES = {
  TEXT: 'text',
  MULTIMEDIA: 'multimedia'
};

const ROOM_TYPE_CONFIG = {
  text: {
    id: 'text',
    name: 'Solo Texto',
    description: 'Mensajes de texto únicamente',
    features: [
      'Mensajes de texto',
      'Emojis y caracteres especiales',
      'Historial de mensajes',
      'Notificaciones en tiempo real'
    ],
    multimediaConfig: {
      maxFileSize: 0,
      allowedFileTypes: [],
      steganographyCheck: false
    }
  },
  multimedia: {
    id: 'multimedia',
    name: 'Multimedia',
    description: 'Texto, imágenes, archivos y más',
    features: [
      'Mensajes de texto',
      'Imágenes (JPEG, PNG, GIF, WEBP)',
      'Documentos (PDF, Word)',
      'Videos (MP4, WEBM)',
      'Audio (MP3, WAV)',
      'Análisis de esteganografía'
    ],
    multimediaConfig: {
      maxFileSize: 15728640, // 15MB
      allowedFileTypes: [
        'image/jpeg',
        'image/png',
        'image/gif',
        'image/webp',
        'image/bmp',
        'image/x-ms-bmp',
        'image/x-bmp',
        'application/pdf',
        'application/msword',
        'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        'video/mp4',
        'video/webm',
        'audio/mpeg',
        'audio/wav'
      ],
      steganographyCheck: true
    }
  }
};

/**
 * Obtiene la configuración multimedia para un tipo de sala
 * @param {string} roomType - Tipo de sala ('text' o 'multimedia')
 * @returns {Object} Configuración multimedia
 */
function getMultimediaConfig(roomType) {
  const config = ROOM_TYPE_CONFIG[roomType];
  if (!config) {
    // Default a configuración de solo texto
    return ROOM_TYPE_CONFIG.text.multimediaConfig;
  }
  return config.multimediaConfig;
}

/**
 * Valida la configuración de una sala
 * @param {Object} config - Configuración a validar
 * @returns {Object} { isValid: boolean, errors: string[] }
 */
function validateRoomConfig(config) {
  const errors = [];

  // Validar nombre
  if (!config.name || typeof config.name !== 'string') {
    errors.push('El nombre de la sala es requerido');
  } else {
    const trimmedName = config.name.trim();
    if (trimmedName.length < ROOM_LIMITS.NAME_MIN_LENGTH) {
      errors.push(`El nombre debe tener al menos ${ROOM_LIMITS.NAME_MIN_LENGTH} caracteres`);
    }
    if (trimmedName.length > ROOM_LIMITS.NAME_MAX_LENGTH) {
      errors.push(`El nombre no puede exceder ${ROOM_LIMITS.NAME_MAX_LENGTH} caracteres`);
    }
  }

  // Validar tipo de sala
  if (!config.roomType || !Object.values(ROOM_TYPES).includes(config.roomType)) {
    errors.push('Tipo de sala inválido. Debe ser "text" o "multimedia"');
  }

  // Validar maxParticipants
  if (!config.maxParticipants || typeof config.maxParticipants !== 'number') {
    errors.push('El límite de participantes es requerido');
  } else {
    if (config.maxParticipants < ROOM_LIMITS.MIN_PARTICIPANTS || 
        config.maxParticipants > ROOM_LIMITS.MAX_PARTICIPANTS) {
      errors.push(
        `El límite debe estar entre ${ROOM_LIMITS.MIN_PARTICIPANTS} y ${ROOM_LIMITS.MAX_PARTICIPANTS} participantes`
      );
    }
  }

  return {
    isValid: errors.length === 0,
    errors
  };
}

/**
 * Valida si un tipo de archivo está permitido para una sala
 * @param {string} fileType - MIME type del archivo
 * @param {string} roomType - Tipo de sala
 * @returns {boolean}
 */
function isFileTypeAllowed(fileType, roomType) {
  const config = ROOM_TYPE_CONFIG[roomType];
  if (!config || roomType === ROOM_TYPES.TEXT) {
    return false;
  }
  return config.multimediaConfig.allowedFileTypes.includes(fileType);
}

/**
 * Obtiene el tamaño máximo de archivo permitido para una sala
 * @param {string} roomType - Tipo de sala
 * @returns {number} Tamaño máximo en bytes
 */
function getMaxFileSize(roomType) {
  const config = ROOM_TYPE_CONFIG[roomType];
  if (!config) {
    return 0;
  }
  return config.multimediaConfig.maxFileSize;
}

module.exports = {
  ROOM_LIMITS,
  ROOM_TYPES,
  ROOM_TYPE_CONFIG,
  getMultimediaConfig,
  validateRoomConfig,
  isFileTypeAllowed,
  getMaxFileSize
};
