const DeviceSession = require('../models/DeviceSession');

exports.registerSession = async (deviceId, ip, roomPin, nickname) => {
    try {
        // verificar por ip para evitar multiples usuarios desde el mismo dispositivo
        const existingSession = await DeviceSession.findOne({ ip, roomPin });

        if (existingSession) {
            // actualizar la sesion existente
            existingSession.nickname = nickname;
            existingSession.deviceId = deviceId;
            existingSession.lastActive = Date.now();
            await existingSession.save();
            return existingSession;
        }

        // crear nueva sesion
        const session = await DeviceSession.create({ 
            deviceId, 
            ip, 
            roomPin, 
            nickname,
            lastActive: Date.now()
        });
        return session;

    } catch (error) {
        console.error('Error en registerSession:', error);
        throw error;
    }
};

exports.validateSession = async (deviceId, ip, roomPin) => {
    // buscar por ip
    const session = await DeviceSession.findOne({ ip, roomPin });
    if (session) {
        // actualizar ultima actividad
        session.lastActive = Date.now();
        session.deviceId = deviceId;
        await session.save();
        return true;
    }
    return false;
};

exports.removeSession = async (deviceId, ip, roomPin) => {
    try {
        // eliminar por ip
        const result = await DeviceSession.deleteOne({ ip, roomPin });
        console.log('removeSession resultado:', { 
            deviceId,
            ip, 
            roomPin, 
            deletedCount: result.deletedCount 
        });
        return result;
    } catch (error) {
        console.error('Error en removeSession:', error);
        throw error;
    }
};

exports.getSessionByIp = async (ip, roomPin) => {
    return await DeviceSession.findOne({ ip, roomPin });
};

exports.getSessionByDeviceId = async (deviceId, roomPin) => {
    return await DeviceSession.findOne({ deviceId, roomPin });
};
