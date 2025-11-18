require('dotenv').config();
const mongoose = require('mongoose');
const Room = require('../models/RoomModel');
const RoomMembership = require('../models/RoomMembership');
const Message = require('../models/Message');

async function cleanOldRooms() {
  try {
    console.log('Conectando a MongoDB...');
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('Conectado a MongoDB\n');

    // Definir el tiempo de antigüedad (por ejemplo, 7 días)
    const daysOld = process.env.CLEAN_DAYS_OLD || 7;
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - daysOld);
    // Buscar salas antiguas que no estén activas
    const oldRooms = await Room.find({
      $or: [
        { updatedAt: { $lt: cutoffDate } },
        { lastActivityAt: { $lt: cutoffDate } }
      ]
    });
    if (oldRooms.length === 0) {
      await mongoose.connection.close();
      return;
    }

    let deletedRooms = 0;
    let deletedMemberships = 0;
    let deletedMessages = 0;

    for (const room of oldRooms) {
      // Eliminar membresías asociadas
      const membershipsResult = await RoomMembership.deleteMany({ roomId: room._id });
      deletedMemberships += membershipsResult.deletedCount;

      // Eliminar mensajes asociados
      const messagesResult = await Message.deleteMany({ roomId: room._id });
      deletedMessages += messagesResult.deletedCount;

      // Eliminar la sala
      await Room.deleteOne({ _id: room._id });
      deletedRooms++;

      console.log(` Eliminada (${membershipsResult.deletedCount} membresías, ${messagesResult.deletedCount} mensajes)\n`);
    }

  } catch (error) {
    console.error('Error durante la limpieza:', error);
  } finally {
    await mongoose.connection.close();
    console.log('🔌 Desconectado de MongoDB');
    process.exit(0);
  }
}

// Ejecutar si se llama directamente
if (require.main === module) {
  cleanOldRooms();
}

module.exports = { cleanOldRooms };
