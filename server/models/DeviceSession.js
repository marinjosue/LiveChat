const mongoose = require('mongoose');

const DeviceSessionSchema = new mongoose.Schema({
    deviceId: { type: String, required: true, unique: true },
    roomPin: { type: String, required: true },
});

module.exports = mongoose.model('DeviceSession', DeviceSessionSchema);
