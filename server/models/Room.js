const crypto = require('crypto');

class Room {
  constructor(pin, limit = null, roomType = 'text', roomName = null, options = {}) {
    this.pin = pin;
    
    // Hash del PIN para almacenamiento seguro (aunque el PIN ya está en memoria)
    this.hashedPin = this._hashPin(pin);
    
    // ID encriptado único de la sala
    this.encryptedId = this._generateEncryptedId();
    
    // Nombre de la sala
    this.name = roomName || `Sala ${pin}`;
    
    // Tipo de sala: 'text' o 'multimedia'
    this.roomType = roomType;
    
    // Límite de usuarios
    this.limit = limit ? parseInt(limit) : null;
    
    // Configuración para salas multimedia
    this.multimediaConfig = {
      maxFileSize: options.maxFileSize || 15 * 1024 * 1024, // 15MB por defecto
      allowedFileTypes: options.allowedFileTypes || [
        'image/jpeg', 'image/png', 'image/gif', 'image/webp',
        'application/pdf', 'application/msword',
        'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        'video/mp4', 'video/webm',
        'audio/mpeg', 'audio/wav'
      ],
      steganographyCheck: options.steganographyCheck !== false // Habilitado por defecto
    };
    
    // Usuarios en la sala
    this.users = [];
    
    // Timestamps
    this.createdAt = new Date();
    this.lastActivity = new Date();
    
    // Administrador que creó la sala (opcional)
    this.createdBy = options.createdBy || null;
    
    // Estado de la sala
    this.isActive = true;
  }

  /**
   * Genera hash SHA-256 del PIN
   */
  _hashPin(pin) {
    return crypto.createHash('sha256').update(pin.toString()).digest('hex');
  }

  /**
   * Genera ID encriptado único
   */
  _generateEncryptedId() {
    const data = `${Date.now()}-${Math.random()}-${process.pid}`;
    return crypto.createHash('sha256').update(data).digest('hex').substring(0, 16);
  }

  /**
   * Verifica si el PIN proporcionado es correcto
   */
  verifyPin(providedPin) {
    return this.hashedPin === this._hashPin(providedPin);
  }

  /**
   * Verifica si un tipo de archivo está permitido
   */
  isFileTypeAllowed(mimeType) {
    if (this.roomType === 'text') {
      return false; // No se permiten archivos en salas de solo texto
    }
    return this.multimediaConfig.allowedFileTypes.includes(mimeType);
  }

  /**
   * Verifica si un archivo excede el tamaño máximo
   */
  isFileSizeValid(fileSize) {
    return fileSize <= this.multimediaConfig.maxFileSize;
  }

  addUser(id, nickname, deviceId) {
    // Primero verificamos si ya existe un usuario con este deviceId
    const existingUserIndex = this.users.findIndex(u => u.deviceId === deviceId);
    
    // Si existe, lo reemplazamos con el nuevo
    if (existingUserIndex !== -1) {
      this.users[existingUserIndex] = { id, nickname, deviceId, joinedAt: new Date() };
    } else {
      // Si no existe, lo añadimos
      this.users.push({ id, nickname, deviceId, joinedAt: new Date() });
    }
    
    this.updateActivity();
    return this.users.length;
  }

  removeUser(id) {
    const index = this.users.findIndex(u => u.id === id);
    if (index !== -1) {
      this.users.splice(index, 1);
      this.updateActivity();
    }
    return this.users.length;
  }

  removeUserByDeviceId(deviceId) {
    const index = this.users.findIndex(u => u.deviceId === deviceId);
    if (index !== -1) {
      this.users.splice(index, 1);
      this.updateActivity();
    }
    return this.users.length;
  }

  getUser(id) {
    return this.users.find(u => u.id === id);
  }

  getUserByDeviceId(deviceId) {
    return this.users.find(u => u.deviceId === deviceId);
  }

  isEmpty() {
    return this.users.length === 0;
  }

  isFull() {
    if (!this.limit) return false;
    return this.users.length >= this.limit;
  }

  updateActivity() {
    this.lastActivity = new Date();
  }

  getUserCount() {
    return this.users.length;
  }

  // Método para obtener información resumida de la sala
  getRoomInfo() {
    return {
      pin: this.pin,
      name: this.name,
      encryptedId: this.encryptedId,
      roomType: this.roomType,
      userCount: this.users.length,
      limit: this.limit,
      createdAt: this.createdAt,
      lastActivity: this.lastActivity,
      isActive: this.isActive,
      multimediaConfig: this.roomType === 'multimedia' ? {
        maxFileSize: this.multimediaConfig.maxFileSize,
        allowedFileTypes: this.multimediaConfig.allowedFileTypes.length,
        steganographyCheck: this.multimediaConfig.steganographyCheck
      } : null
    };
  }
  
  /**
   * Cambia el tipo de sala (solo si está vacía)
   */
  changeRoomType(newType, adminId = null) {
    if (this.users.length > 0) {
      throw new Error('Cannot change room type while users are connected');
    }
    
    if (!['text', 'multimedia'].includes(newType)) {
      throw new Error('Invalid room type');
    }
    
    this.roomType = newType;
    this.lastActivity = new Date();
    
    return {
      success: true,
      roomType: this.roomType,
      changedBy: adminId
    };
  }
  
  /**
   * Actualiza configuración multimedia
   */
  updateMultimediaConfig(config, adminId = null) {
    if (this.roomType === 'text') {
      throw new Error('Cannot update multimedia config for text-only room');
    }
    
    if (config.maxFileSize) {
      this.multimediaConfig.maxFileSize = config.maxFileSize;
    }
    
    if (config.allowedFileTypes) {
      this.multimediaConfig.allowedFileTypes = config.allowedFileTypes;
    }
    
    if (config.steganographyCheck !== undefined) {
      this.multimediaConfig.steganographyCheck = config.steganographyCheck;
    }
    
    this.lastActivity = new Date();
    
    return {
      success: true,
      config: this.multimediaConfig,
      updatedBy: adminId
    };
  }
}

module.exports = Room;