require('dotenv').config();
const mongoose = require('mongoose');
const Room = require('../models/RoomModel');
const RoomMembership = require('../models/RoomMembership');
const Message = require('../models/Message');
const readline = require('readline');

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

async function deleteAllRooms() {
  try {
    console.log('🔌 Conectando a MongoDB...');
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('✅ Conectado a MongoDB\n');

    // Contar todos los registros
    const roomCount = await Room.countDocuments();
    const membershipCount = await RoomMembership.countDocuments();
    const messageCount = await Message.countDocuments();

    console.log('📊 REGISTROS ACTUALES:');
    console.log(`   🏠 Salas: ${roomCount}`);
    console.log(`   👥 Membresías: ${membershipCount}`);
    console.log(`   💬 Mensajes: ${messageCount}\n`);

    if (roomCount === 0) {
      console.log('✨ No hay salas para eliminar');
      await mongoose.connection.close();
      rl.close();
      return;
    }

    // Pedir confirmación
    rl.question('⚠️  ¿Estás SEGURO de que quieres eliminar TODAS las salas? (escribe "SI" para confirmar): ', async (answer) => {
      if (answer.toUpperCase() === 'SI') {
        console.log('\n🗑️  Eliminando todas las salas...\n');

        // Eliminar todo
        const membershipsResult = await RoomMembership.deleteMany({});
        const messagesResult = await Message.deleteMany({});
        const roomsResult = await Room.deleteMany({});

        console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
        console.log('📈 RESUMEN DE ELIMINACIÓN TOTAL:');
        console.log(`   🗑️  Salas eliminadas: ${roomsResult.deletedCount}`);
        console.log(`   👥 Membresías eliminadas: ${membershipsResult.deletedCount}`);
        console.log(`   💬 Mensajes eliminados: ${messagesResult.deletedCount}`);
        console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
        console.log('✅ Todas las salas han sido eliminadas');

      } else {
        console.log('\n❌ Operación cancelada');
      }

      await mongoose.connection.close();
      console.log('🔌 Desconectado de MongoDB');
      rl.close();
      process.exit(0);
    });

  } catch (error) {
    console.error('❌ Error durante la eliminación:', error);
    await mongoose.connection.close();
    rl.close();
    process.exit(1);
  }
}

// Ejecutar
console.log('╔═══════════════════════════════════════╗');
console.log('║   🧹 ELIMINAR TODAS LAS SALAS        ║');
console.log('║   ⚠️  ADVERTENCIA: ESTO ES           ║');
console.log('║      IRREVERSIBLE                     ║');
console.log('╚═══════════════════════════════════════╝\n');

deleteAllRooms();
