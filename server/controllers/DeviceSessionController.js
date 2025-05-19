const DeviceSession = require('../models/DeviceSession');

exports.registerSession = async (deviceId, roomPin) => {
    const existingSession = await DeviceSession.findOne({ deviceId });

    if (existingSession) {
        if (existingSession.roomPin !== roomPin) {
            throw new Error('Dispositivo ya está en otra sala');
        } else {
            throw new Error('Este dispositivo ya está en esta sala');
        }
    }

    await DeviceSession.create({ deviceId, roomPin });
};

exports.removeSession = async (deviceId) => {
    await DeviceSession.deleteOne({ deviceId });
};
