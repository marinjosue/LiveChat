const Room = require('../models/Room');
const generatePIN = require('../utils/pinGenerator');
const { registerSession, removeSession } = require('./DeviceSessionController');
const Message = require('../models/Message');
const DeviceSession = require('../models/DeviceSession');


const rooms = {};

function RoomController(io) {
  io.on('connection', (socket) => {
    console.log(`Nuevo cliente conectado: ${socket.id}`);

    // Crear sala
    socket.on('createRoom', async ({ limit, nickname, deviceId }, callback) => {
      try {
        // Validar máximo de 15 salas activas
        const MAX_ROOMS = 2;
        const activeRoomsCount = Object.keys(rooms).length;

        if (activeRoomsCount >= MAX_ROOMS) {
          return callback({ success: false, message: 'Se ha alcanzado el límite máximo de salas activas (15).' });
        }

        const existingPins = Object.keys(rooms);
        const pin = generatePIN(existingPins);
        const room = new Room(pin, limit);
        rooms[pin] = room;

        await registerSession(deviceId, pin);

        room.addUser(socket.id, nickname, deviceId);
        socket.join(pin);

        console.log(`Sala creada con PIN: ${pin} por ${nickname}`);
        io.to(pin).emit('userJoined', { userId: socket.id, nickname, count: room.users.length, limit: room.limit });
        callback({ success: true, pin });
      } catch (err) {
        callback({ success: false, message: err.message });
      }
    });


    // Unirse a sala
    socket.on('joinRoom', async ({ pin, nickname, deviceId }, callback) => {
      const room = rooms[pin];
      if (!room) return callback({ success: false, message: 'PIN inválido.' });
      if (room.isFull()) return callback({ success: false, message: 'La sala está llena.' });

      try {
        await registerSession(deviceId, pin);
        room.addUser(socket.id, nickname, deviceId);
        socket.join(pin);

        const previousMessages = await Message.find({ pin }).sort({ timestamp: 1 });
        socket.emit('previousMessages', previousMessages);

        io.to(pin).emit('userJoined', { userId: socket.id, nickname, count: room.users.length, limit: room.limit });
        callback({ success: true, pin });
      } catch (err) {
        callback({ success: false, message: err.message });
      }
    });

    // Reconectar a sala
    socket.on('reconnectToRoom', async ({ pin, nickname, deviceId }, callback) => {
      const room = rooms[pin];
      if (!room) return callback({ success: false, message: 'Sala no encontrada para reconectar.' });

      try {
        await registerSession(deviceId, pin);
        room.addUser(socket.id, nickname, deviceId);
        socket.join(pin);

        const previousMessages = await Message.find({ pin }).sort({ timestamp: 1 });
        socket.emit('previousMessages', previousMessages);

        io.to(pin).emit('userJoined', { userId: socket.id, nickname, count: room.users.length, limit: room.limit });
        callback({ success: true, pin });
      } catch (err) {
        callback({ success: false, message: err.message });
      }
    });

    // Enviar mensaje
    socket.on('chatMessage', async ({ pin, text }) => {
      const room = rooms[pin];
      if (!room) return;

      const user = room.users.find(u => u.id === socket.id);
      const sender = user ? user.nickname : 'Anónimo';

      io.to(pin).emit('chatMessage', { sender, text });
      await Message.create({ pin, sender, text });
    });
    //cargar mensaje 
    socket.on('requestPreviousMessages', async ({ pin }) => {
      const previousMessages = await Message.find({ pin }).sort({ timestamp: 1 });
      socket.emit('previousMessages', previousMessages);
    });


    // Salir de sala
    socket.on('leaveRoom', async ({ pin, deviceId }) => {
      const room = rooms[pin];
      if (!room) return;

      const user = room.users.find(u => u.id === socket.id);
      const nickname = user ? user.nickname : 'Desconocido';
      room.removeUser(socket.id);
      socket.leave(pin);

      await removeSession(deviceId);

      if (room.isEmpty()) {
        await Message.deleteMany({ pin });
        await DeviceSession.deleteMany({ roomPin: pin });  // Elimina todas las sesiones de la sala
        delete rooms[pin];
        console.log(`Sala ${pin} eliminada por estar vacía, sus mensajes y sus sesiones eliminadas`);
      }
      else {
        io.to(pin).emit('userLeft', { userId: socket.id, nickname, count: room.users.length, limit: room.limit });
      }
    });

    // Desconexión
    socket.on('disconnect', async () => {
      console.log(`Cliente desconectado: ${socket.id}`);
      for (const pin in rooms) {
        const room = rooms[pin];
        const user = room.users.find(u => u.id === socket.id);

        if (user) {
          const nickname = user.nickname || 'Desconocido';
          const deviceId = user.deviceId; // Obtener el deviceId registrado

          room.removeUser(socket.id);
          socket.leave(pin);

          await removeSession(deviceId); // Asegurar que la sesión se elimine

          if (room.isEmpty()) {
            await Message.deleteMany({ pin });
            await DeviceSession.deleteMany({ roomPin: pin });  // Elimina todas las sesiones de la sala
            delete rooms[pin];
            console.log(`Sala ${pin} eliminada por estar vacía, sus mensajes y sus sesiones eliminadas`);
          }
          else {
            io.to(pin).emit('userLeft', { userId: socket.id, nickname, count: room.users.length, limit: room.limit });
          }
        }
      }
    });
  });
}

module.exports = RoomController;
