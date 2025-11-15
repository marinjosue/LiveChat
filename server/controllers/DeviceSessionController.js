const DeviceSession = require('../models/DeviceSession');
const RoomMembership = require('../models/RoomMembership');

exports.registerSession = async (deviceId, ip, roomPin, nickname) => {
    try {
        // 🔒 BUSCAR POR IP (único por dispositivo, sin importar navegador)
        const existingSession = await DeviceSession.findOne({ ip });

        if (existingSession) {
            // Si la IP ya tiene sesión, verificar que sea en la misma sala
            if (existingSession.roomPin === roomPin) {
                // Actualizar la sesión existente (puede ser otro navegador del mismo dispositivo)
                existingSession.nickname = nickname;
                existingSession.deviceId = deviceId; // Actualizar deviceId (puede cambiar entre navegadores)
                existingSession.lastActive = Date.now();
                await existingSession.save();
                console.log(`✅ Sesión actualizada para IP ${ip} en sala ${roomPin}`);
                return existingSession;
            } else {
                // La IP ya está en OTRA sala - esto no debería pasar si la validación funciona
                throw new Error(`La IP ${ip} ya está registrada en la sala ${existingSession.roomPin}`);
            }
        }

        // Crear nueva sesión (primera vez que esta IP se une a una sala)
        const session = await DeviceSession.create({ 
            deviceId, 
            ip, 
            roomPin, 
            nickname,
            lastActive: Date.now()
        });
        
        console.log(`✅ Nueva sesión creada para IP ${ip} en sala ${roomPin}`);
        
        // ✅ CREAR PERTENENCIA A SALA
        await RoomMembership.createOrUpdate(deviceId, nickname, roomPin, ip);
        
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
        // 🔒 ELIMINAR POR IP ÚNICAMENTE (no importa el deviceId)
        // Esto asegura que se elimine la sesión del dispositivo completo
        const result = await DeviceSession.deleteOne({ ip });
        console.log('🗑️ removeSession resultado:', { 
            deviceId,
            ip, 
            roomPin, 
            deletedCount: result.deletedCount 
        });
        
        if (result.deletedCount === 0) {
            console.log(`⚠️ No se encontró sesión para eliminar con IP: ${ip}`);
        } else {
            console.log(`✅ Sesión eliminada exitosamente para IP: ${ip}`);
        }
        
        return result;
    } catch (error) {
        console.error('Error en removeSession:', error);
        throw error;
    }
};

exports.getSessionByIp = async (ip, roomPin) => {
    const session = await DeviceSession.findOne({ ip, roomPin });
    console.log(`🔍 getSessionByIp: IP=${ip}, roomPin=${roomPin}, encontrada=${session ? 'SÍ' : 'NO'}`);
    return session;
};

exports.getSessionByDeviceId = async (deviceId, roomPin) => {
    return await DeviceSession.findOne({ deviceId, roomPin });
};
