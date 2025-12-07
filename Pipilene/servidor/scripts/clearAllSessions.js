const mongoose = require('mongoose');
require('dotenv').config();

async function clearAllSessions() {
  try {
    // Conectar a MongoDB
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('✅ Conectado a MongoDB');

    const db = mongoose.connection.db;
    
    // Limpiar colecciones
    console.log('\n🗑️  Limpiando sesiones...');
    
    const deviceSessionsResult = await db.collection('devicesessions').deleteMany({});
    console.log(`✅ DeviceSessions eliminadas: ${deviceSessionsResult.deletedCount}`);
    
    const roomMembershipsResult = await db.collection('room_memberships').deleteMany({});
    console.log(`✅ RoomMemberships eliminadas: ${roomMembershipsResult.deletedCount}`);
    
    console.log('\n✅ ¡Todas las sesiones han sido limpiadas!');
    console.log('Ahora puedes conectarte nuevamente desde cero.');
    
  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    await mongoose.disconnect();
    console.log('\n👋 Desconectado de MongoDB');
    process.exit(0);
  }
}

clearAllSessions();
