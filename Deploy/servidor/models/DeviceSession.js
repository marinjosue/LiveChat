const mongoose = require('mongoose');

const deviceSessionSchema = new mongoose.Schema({
  deviceId: {
    type: String,
    required: true,
    index: true  
  },
  ipAddress: {
    type: String,
    required: true
    // Ya no es único - un dispositivo puede tener múltiples IPs
  },
  pin: {
    type: String,
    required: true,
    index: true
  },
  nickname: { type: String, required: true },
  lastActive: { type: Date, default: Date.now },
  createdAt: { type: Date, default: Date.now, expires: 86400 }
});

// ✅ Índice compuesto para evitar duplicados
deviceSessionSchema.index({ deviceId: 1, pin: 1 }, { unique: true });

// Índice adicional para búsquedas por IP (más rápidas)
deviceSessionSchema.index({ ipAddress: 1 });

// Índice para limpiar sesiones antiguas
deviceSessionSchema.index({ lastActive: 1 });

module.exports = mongoose.model('DeviceSession', deviceSessionSchema);
