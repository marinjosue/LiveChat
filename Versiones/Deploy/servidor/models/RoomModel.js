const mongoose = require('mongoose');
const crypto = require('crypto');

/**
 * Schema de Mongoose para persistir salas en MongoDB
 * Diferente de la clase Room en memoria
 */
const roomSchema = new mongoose.Schema({
  // PIN original (solo para referencia, se usará hashedPin para validación)
  pin: {
    type: String,
    required: true,
    unique: true,
    index: true
  },
  
  // PIN hasheado con SHA-256
  hashedPin: {
    type: String,
    required: true
  },
  
  // ID encriptado único de la sala
  encryptedId: {
    type: String,
    required: true,
    unique: true,
    index: true
  },
  
  // Nombre de la sala
  name: {
    type: String,
    required: true,
    maxlength: 30
  },
  
  // Tipo de sala: 'text' o 'multimedia'
  roomType: {
    type: String,
    enum: ['text', 'multimedia'],
    default: 'text'
  },
  
  // Límite de participantes
  maxParticipants: {
    type: Number,
    min: 2,
    max: 50,
    required: true
  },
  
  // Participantes actuales (conteo)
  participantCount: {
    type: Number,
    default: 0
  },
  
  // Configuración multimedia
  multimediaConfig: {
    maxFileSize: {
      type: Number,
      default: 15728640 // 15MB
    },
    allowedFileTypes: [{
      type: String
    }],
    steganographyCheck: {
      type: Boolean,
      default: true
    }
  },
  
  // Admin que creó la sala
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Admin',
    default: null
  },
  
  // Estado de la sala
  isActive: {
    type: Boolean,
    default: true
  },
  
  // Timestamps
  createdAt: {
    type: Date,
    default: Date.now
  },
  
  lastActivity: {
    type: Date,
    default: Date.now
  },
  
  // Auto-eliminación después de inactividad (1 hora)
  expiresAt: {
    type: Date,
    index: { expires: 3600 } // TTL index: 1 hora
  }
}, {
  timestamps: true
});

// Índices compuestos para búsquedas eficientes
roomSchema.index({ isActive: 1, createdAt: -1 });
roomSchema.index({ pin: 1, isActive: 1 });

/**
 * Método estático para hashear PIN
 */
roomSchema.statics.hashPin = function(pin) {
  return crypto.createHash('sha256').update(pin.toString()).digest('hex');
};

/**
 * Método estático para generar ID encriptado
 */
roomSchema.statics.generateEncryptedId = function() {
  const data = `${Date.now()}-${Math.random()}-${process.pid}`;
  return crypto.createHash('sha256').update(data).digest('hex').substring(0, 16);
};

/**
 * Método de instancia para verificar PIN
 */
roomSchema.methods.verifyPin = function(providedPin) {
  const hashedProvided = crypto.createHash('sha256').update(providedPin.toString()).digest('hex');
  return this.hashedPin === hashedProvided;
};

/**
 * Método de instancia para verificar si tipo de archivo permitido
 */
roomSchema.methods.isFileTypeAllowed = function(mimeType) {
  if (this.roomType === 'text') return false;
  return this.multimediaConfig.allowedFileTypes.includes(mimeType);
};

/**
 * Método de instancia para verificar tamaño de archivo
 */
roomSchema.methods.isFileSizeValid = function(fileSize) {
  return fileSize <= this.multimediaConfig.maxFileSize;
};

/**
 * Método de instancia para verificar si está llena
 */
roomSchema.methods.isFull = function() {
  return this.participantCount >= this.maxParticipants;
};

/**
 * Método de instancia para incrementar contador de participantes
 */
roomSchema.methods.incrementParticipants = async function() {
  this.participantCount += 1;
  this.lastActivity = new Date();
  this.expiresAt = null; // Cancelar expiración mientras hay usuarios
  return await this.save();
};

/**
 * Método de instancia para decrementar contador de participantes
 */
roomSchema.methods.decrementParticipants = async function() {
  if (this.participantCount > 0) {
    this.participantCount -= 1;
    this.lastActivity = new Date();
    
    // Si queda vacía, programar expiración en 1 hora
    if (this.participantCount === 0) {
      this.expiresAt = new Date(Date.now() + 3600000); // 1 hora
    }
    
    return await this.save();
  }
};

/**
 * Método de instancia para marcar como inactiva
 */
roomSchema.methods.deactivate = async function() {
  this.isActive = false;
  this.lastActivity = new Date();
  return await this.save();
};

/**
 * Middleware pre-save para auto-generar campos si no existen
 */
roomSchema.pre('save', function(next) {
  // Auto-generar hashedPin si no existe
  if (!this.hashedPin && this.pin) {
    this.hashedPin = crypto.createHash('sha256').update(this.pin.toString()).digest('hex');
  }
  
  // Auto-generar encryptedId si no existe
  if (!this.encryptedId) {
    const data = `${Date.now()}-${Math.random()}-${process.pid}`;
    this.encryptedId = crypto.createHash('sha256').update(data).digest('hex').substring(0, 16);
  }
  
  // Configurar tipos de archivo permitidos por defecto
  if (this.roomType === 'multimedia' && (!this.multimediaConfig.allowedFileTypes || this.multimediaConfig.allowedFileTypes.length === 0)) {
    this.multimediaConfig.allowedFileTypes = [
      'image/jpeg', 'image/png', 'image/gif', 'image/webp',
      'image/bmp', 'image/x-ms-bmp', 'image/x-bmp',
      'application/pdf', 'application/msword',
      'application/vnd.openxmlformats-oficedocument.wordprocessingml.document',
      'video/mp4', 'video/webm',
      'audio/mpeg', 'audio/wav'
    ];
  }
  
  next();
});

const RoomModel = mongoose.model('Room', roomSchema);

module.exports = RoomModel;
