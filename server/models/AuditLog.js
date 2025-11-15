const mongoose = require('mongoose');

const auditLogSchema = new mongoose.Schema({
  // Información del administrador
  adminId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Admin',
    required: false,
    index: true,
    default: null
  },
  adminUsername: {
    type: String,
    required: true
  },
  // Acción realizada
  action: {
    type: String,
    required: true,
    enum: [
      // Autenticación
      'LOGIN_SUCCESS',
      'LOGIN_FAILED',
      'LOGOUT',
      '2FA_ENABLED',
      '2FA_DISABLED',
      '2FA_VERIFIED',
      '2FA_FAILED',
      'PASSWORD_CHANGED',
      'ACCOUNT_LOCKED',
      
      // Gestión de salas
      'ROOM_CREATED',
      'ROOM_DELETED',
      'ROOM_MODIFIED',
      'ROOM_VIEWED',
      
      // Gestión de usuarios
      'USER_KICKED',
      'USER_BANNED',
      'USER_VIEWED',
      
      // Gestión de archivos
      'FILE_UPLOADED',
      'FILE_REJECTED',
      'FILE_DELETED',
      'STEGANOGRAPHY_DETECTED',
      
      // Configuración
      'CONFIG_CHANGED',
      'ADMIN_CREATED',
      'ADMIN_DELETED',
      'ADMIN_MODIFIED',
      
      // Seguridad
      'SECURITY_BREACH_ATTEMPT',
      'RATE_LIMIT_EXCEEDED',
      'INVALID_TOKEN',
      'SUSPICIOUS_ACTIVITY',
      
      // Logs
      'LOGS_FILES_LISTED',
      'LOG_FILE_VIEWED'
    ]
  },
  // Detalles de la acción
  details: {
    type: mongoose.Schema.Types.Mixed,
    default: {}
  },
  // Contexto de la solicitud
  ipAddress: {
    type: String,
    required: true
  },
  userAgent: {
    type: String,
    default: null
  },
  // Resultado de la acción
  status: {
    type: String,
    enum: ['SUCCESS', 'FAILURE', 'WARNING'],
    required: true
  },
  errorMessage: {
    type: String,
    default: null
  },
  // Timestamp
  timestamp: {
    type: Date,
    default: Date.now,
    index: true
  },
  // Hash de integridad (para no repudio)
  integrityHash: {
    type: String,
    required: true
  }
});

// Índices compuestos para consultas eficientes
auditLogSchema.index({ adminId: 1, timestamp: -1 });
auditLogSchema.index({ action: 1, timestamp: -1 });
auditLogSchema.index({ status: 1, timestamp: -1 });
auditLogSchema.index({ timestamp: -1 });

// Método estático para crear log con hash de integridad
auditLogSchema.statics.createLog = async function(logData) {
  const crypto = require('crypto');
  
  // Crear hash de integridad para no repudio
  const dataString = JSON.stringify({
    adminId: logData.adminId,
    action: logData.action,
    timestamp: logData.timestamp || new Date(),
    details: logData.details
  });
  
  const integrityHash = crypto
    .createHash('sha256')
    .update(dataString)
    .digest('hex');
  
  const log = new this({
    ...logData,
    integrityHash
  });
  
  return await log.save();
};

// Método para verificar la integridad del log
auditLogSchema.methods.verifyIntegrity = function() {
  const crypto = require('crypto');
  
  const dataString = JSON.stringify({
    adminId: this.adminId,
    action: this.action,
    timestamp: this.timestamp,
    details: this.details
  });
  
  const calculatedHash = crypto
    .createHash('sha256')
    .update(dataString)
    .digest('hex');
  
  return calculatedHash === this.integrityHash;
};

// Prevenir modificación de logs (inmutabilidad)
auditLogSchema.pre('findOneAndUpdate', function() {
  throw new Error('Los logs de auditoría no pueden ser modificados');
});

auditLogSchema.pre('updateOne', function() {
  throw new Error('Los logs de auditoría no pueden ser modificados');
});

auditLogSchema.pre('updateMany', function() {
  throw new Error('Los logs de auditoría no pueden ser modificados');
});

module.exports = mongoose.model('AuditLog', auditLogSchema);
