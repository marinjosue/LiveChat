const mongoose = require('mongoose');

const DeviceSessionSchema = new mongoose.Schema({
    deviceId: { type: String, required: true },
    ip: { type: String, required: true },
    roomPin: { type: String, required: true },
    nickname: { type: String, required: true },
    lastActive: { type: Date, default: Date.now },
    createdAt: { type: Date, default: Date.now, expires: 86400 }
});

// indice compuesto para garantizar una sesion unica por ip y sala
DeviceSessionSchema.index({ ip: 1, roomPin: 1 }, { unique: true });

module.exports = mongoose.model('DeviceSession', DeviceSessionSchema);
