const DeviceSession = require('../models/DeviceSession');

exports.registerSession = async (deviceId, roomPin) => {
    try {
        let session = await DeviceSession.findOne({ deviceId });

        if (session) {
            if (session.roomPin === roomPin) {
                // La sesión ya existe para esta sala - OK
                return session;
            } else {
                // El dispositivo está en otra sala
                throw new Error('Dispositivo ya está en otra sala');
            }
        }

        // Nueva sesión
        session = await DeviceSession.create({ deviceId, roomPin });
        return session;

    } catch (error) {
        console.error('Error en registerSession:', error);
        throw error;
    }
};

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


exports.validateSession = async (deviceId, roomPin) => {
    const session = await DeviceSession.findOne({ deviceId, roomPin });
    return !!session;
};
