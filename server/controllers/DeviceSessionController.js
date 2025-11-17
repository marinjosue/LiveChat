const DeviceSession = require('../models/DeviceSession');
const RoomMembership = require('../models/RoomMembership');

exports.registerSession = async (deviceId, ip, roomPin, nickname) => {
    try {
        // 🔒 BUSCAR TODAS LAS SESIONES POR IP (único por dispositivo)
        const existingSessions = await DeviceSession.find({ ip });

        if (existingSessions.length > 0) {
            console.log(`🔍 registerSession: IP ${ip} tiene ${existingSessions.length} sesión(es) existente(s)`);
            
            // Verificar si todas son de la misma sala
            const uniqueRooms = [...new Set(existingSessions.map(s => s.roomPin))];
            
            if (uniqueRooms.length > 1) {
                // ERROR: Múltiples salas - limpiar todo
                console.error(`🚨 ERROR: IP ${ip} tiene sesiones en múltiples salas:`, uniqueRooms);
                await DeviceSession.deleteMany({ ip });
                console.log(`🧹 Sesiones inconsistentes eliminadas`);
            } else if (uniqueRooms[0] === roomPin) {
                // Actualizar sesión existente en la MISMA sala
                const sessionToUpdate = existingSessions[0];
                sessionToUpdate.nickname = nickname;
                sessionToUpdate.deviceId = deviceId;
                sessionToUpdate.lastActive = Date.now();
                await sessionToUpdate.save();
                
                // Eliminar sesiones duplicadas si existen
                if (existingSessions.length > 1) {
                    console.warn(`⚠️ ${existingSessions.length} sesiones duplicadas encontradas. Limpiando...`);
                    for (let i = 1; i < existingSessions.length; i++) {
                        await DeviceSession.deleteOne({ _id: existingSessions[i]._id });
                    }
                    console.log(`🧹 Sesiones duplicadas eliminadas`);
                }
                
                console.log(`✅ Sesión actualizada para IP ${ip} en sala ${roomPin}`);
                return sessionToUpdate;
            } else {
                // Intento de registrar en OTRA sala (no debería llegar aquí si la validación funciona)
                throw new Error(`La IP ${ip} ya está registrada en la sala ${uniqueRooms[0]}. No puede unirse a ${roomPin}.`);
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
        // 🔒 ELIMINAR TODAS las sesiones de esta IP (limpieza completa del dispositivo)
        const result = await DeviceSession.deleteMany({ ip });
        console.log('🗑️ removeSession resultado:', { 
            deviceId,
            ip, 
            roomPin, 
            deletedCount: result.deletedCount 
        });
        
        if (result.deletedCount === 0) {
            console.log(`⚠️ No se encontró sesión para eliminar con IP: ${ip}`);
        } else {
            console.log(`✅ ${result.deletedCount} sesión(es) eliminada(s) exitosamente para IP: ${ip}`);
        }
        
        // Verificar que no quedaron sesiones residuales
        const remainingSessions = await DeviceSession.find({ ip });
        if (remainingSessions.length > 0) {
            console.error(`🚨 ERROR: Quedaron ${remainingSessions.length} sesiones después de eliminar para IP: ${ip}`);
            // Forzar eliminación
            await DeviceSession.deleteMany({ ip });
            console.log(`🧹 Sesiones residuales eliminadas forzadamente`);
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
