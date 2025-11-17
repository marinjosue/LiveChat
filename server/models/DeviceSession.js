const mongoose = require('mongoose');

const DeviceSessionSchema = new mongoose.Schema({
    deviceId: { type: String, required: true },
    ip: { type: String, required: true, index: true }, // IP indexada para búsquedas rápidas
    roomPin: { type: String, required: true, index: true },
    nickname: { type: String, required: true },
    lastActive: { type: Date, default: Date.now },
    createdAt: { type: Date, default: Date.now, expires: 86400 }
});

// Índice único por IP y sala - garantiza que una IP solo puede estar en una sala
DeviceSessionSchema.index({ ip: 1, roomPin: 1 }, { unique: true });

// Índice adicional para búsquedas por IP (más rápidas)
DeviceSessionSchema.index({ ip: 1 });

// Índice para limpiar sesiones antiguas
DeviceSessionSchema.index({ lastActive: 1 });

module.exports = mongoose.model('DeviceSession', DeviceSessionSchema);
