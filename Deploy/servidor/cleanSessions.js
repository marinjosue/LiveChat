const mongoose = require('mongoose');
const DeviceSession = require('./models/DeviceSession');

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/livechat';

async function cleanAllSessions() {
    try {
        await mongoose.connect(MONGODB_URI);

        // Listar todas las sesiones antes
        const sessionsBefore = await DeviceSession.find({});
        console.log(`\nSesiones actuales: ${sessionsBefore.length}`);
        sessionsBefore.forEach(session => {
            console.log(`  - IP: ${session.ip}, PIN: ${session.roomPin}, Nickname: ${session.nickname}`);
        });

        // Eliminar todas las sesiones
        const result = await DeviceSession.deleteMany({});
        console.log(`\nEliminadas ${result.deletedCount} sesiones`);

        // Verificar que se eliminaron
        const sessionsAfter = await DeviceSession.find({});
        console.log(`\nSesiones después de limpiar: ${sessionsAfter.length}`);

        await mongoose.connection.close();
        console.log('\nLimpieza completada');
        process.exit(0);
    } catch (error) {
        console.error('❌ Error:', error);
        process.exit(1);
    }
}

cleanAllSessions();
