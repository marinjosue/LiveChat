const Room = require('../models/Room');
const generatePIN = require('../utils/pinGenerator');
const { registerSession, validateSession, removeSession } = require('./DeviceSessionController');
const Message = require('../models/Message');
const DeviceSession = require('../models/DeviceSession');

const rooms = {};

// Agregar variable global para temporizadores de eliminación de salas
const deletionTimers = {};

// Variable para rastrear usuarios en proceso de recarga
const refreshingUsers = new Set();

function RoomController(io) {
  io.on('connection', (socket) => {
    console.log(`Nuevo cliente conectado: ${socket.id}`);

    // Crear sala
    socket.on('createRoom', async ({ limit, nickname, deviceId }, callback) => {
      try {
        // Validar máximo de 15 salas activas
        const MAX_ROOMS = 15;
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

        // Al crear la sala se garantiza que no haya temporizador pendiente
        if (deletionTimers[pin]) {
          clearTimeout(deletionTimers[pin]);
          delete deletionTimers[pin];
        }

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

        // Cancelar cualquier temporizador de eliminación
        if (deletionTimers[pin]) {
          clearTimeout(deletionTimers[pin]);
          delete deletionTimers[pin];
        }

        const previousMessages = await Message.find({ pin }).sort({ timestamp: 1 });
        socket.emit('previousMessages', previousMessages);

        io.to(pin).emit('userJoined', { userId: socket.id, nickname, count: room.users.length, limit: room.limit });

        // Notificar al cliente si es el único usuario en la sala
        socket.emit('isLastUser', room.users.length === 1);

        callback({ success: true, pin });
      } catch (err) {
        callback({ success: false, message: err.message });
      }
    });

    // Manejar notificación de recarga de página
    socket.on('pageRefreshing', ({ pin, deviceId }) => {
      const key = `${pin}:${deviceId}`;
      refreshingUsers.add(key);

      // Eliminar de la lista después de un tiempo prudencial
      setTimeout(() => {
        refreshingUsers.delete(key);
      }, 30000); // 30 segundos para completar la recarga
    });

    // Manejar notificación de página en refresh
    socket.on('pageRefreshing', ({ pin, deviceId }) => {
      // Marcar el socket como refrescando para evitar removerlo al desconectarse
      socket.refreshing = true;
      console.log(`Socket ${socket.id} indica refresh en sala ${pin}`);
    });

    // Reconectar a sala
    socket.on('reconnectToRoom', async ({ pin, nickname, deviceId }, callback) => {
      try {
        const room = rooms[pin];
        if (!room) {
          return callback({ success: false, message: 'Sala no encontrada' });
        }

        // Validar si el usuario ya existe en la sala
        const existingUser = room.users.find(u => u.deviceId === deviceId);
        if (existingUser) {
            // Actualizar solo el socket ID manteniendo el resto de la información
            existingUser.id = socket.id;
            socket.join(pin);

            // Cargar mensajes previos
            const previousMessages = await Message.find({ pin })
                .sort({ timestamp: 1 })
                .select('sender text timestamp');

            socket.emit('previousMessages', previousMessages);
            
            // Actualizar estado de la sala sin incrementar el contador
            io.to(pin).emit('userJoined', {
                userId: socket.id,
                nickname: existingUser.nickname,
                count: room.users.length,
                limit: room.limit
            });

            return callback({ success: true, pin });
        }

        // Si no existe y la sala está llena, rechazar
        if (room.isFull()) {
            return callback({ success: false, message: 'La sala está llena' });
        }

        // Si es un usuario nuevo, agregarlo normalmente
        room.addUser(socket.id, nickname, deviceId);
        socket.join(pin);
        
        // ...resto del código de reconexión...
    } catch (err) {
        console.error('Error en reconnectToRoom:', err);
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

    // Función auxiliar para manejar salas vacías
    const handleEmptyRoom = async (pin) => {
      const messageCount = await Message.countDocuments({ pin });
      if (messageCount === 0) {
        // Si no hay mensajes, eliminar la sala
        await DeviceSession.deleteMany({ roomPin: pin });
        delete rooms[pin];
        console.log(`Sala ${pin} eliminada por estar vacía y sin mensajes`);
      } else {
        // Si hay mensajes, mantener la sala por un tiempo
        deletionTimers[pin] = setTimeout(async () => {
          const activeUsers = await DeviceSession.countDocuments({ roomPin: pin });
          if (activeUsers === 0) {
            await Message.deleteMany({ pin });
            await DeviceSession.deleteMany({ roomPin: pin });
            delete rooms[pin];
            console.log(`Sala ${pin} eliminada después del período de inactividad`);
          }
        }, 3600000); // 1 hora
      }
    };

    // Salir de sala
    socket.on('leaveRoom', async ({ pin, deviceId, ip }) => {
      const room = rooms[pin];
      if (!room) return;

      const user = room.users.find(u => u.id === socket.id);
      const nickname = user ? user.nickname : 'Desconocido';
      room.removeUser(socket.id);
      socket.leave(pin);

      try {
        // Validar con ambos valores
        const deleted = await DeviceSession.deleteOne({
          $or: [
            { deviceId },
            { deviceId: ip } // En caso de que se haya guardado la IP como deviceId
          ]
        });

        if (deleted.deletedCount === 0) {
          console.warn(`No se encontró ninguna sesión para eliminar con deviceId: ${deviceId} ni IP: ${ip}`);
        } else {
          console.log(`Sesión eliminada correctamente para ${deviceId} o IP: ${ip}`);
        }
      } catch (err) {
        console.error(`Error eliminando sesión:`, err);
      }

      if (room.isEmpty()) {
        await handleEmptyRoom(pin);
      } else {
        io.to(pin).emit('userLeft', { userId: socket.id, nickname, count: room.users.length, limit: room.limit });
      }
    });

    // Desconexión
    socket.on('disconnect', async () => {
      console.log(`Cliente desconectado: ${socket.id}`);

      // Si el socket se ha marcado por refresh, no se realiza el proceso de salida
      if (socket.refreshing) {
        console.log(`Socket ${socket.id} se desconectó por refresh; se omite la salida.`);
        return;
      }

      // Buscar en todas las salas si el usuario está conectado
      for (const pin in rooms) {
        const room = rooms[pin];
        const user = room.users.find(u => u.id === socket.id);

        if (user) {
          const nickname = user.nickname || 'Desconocido';
          const deviceId = user.deviceId;

          // Verificar si el usuario está recargando la página
          const refreshKey = `${pin}:${deviceId}`;
          if (refreshingUsers.has(refreshKey)) {
            console.log(`El usuario ${nickname} (${deviceId}) está recargando la página, no se elimina de la sala ${pin}`);
            refreshingUsers.delete(refreshKey);
            continue; // No hacer nada más con este usuario, está recargando
          }

          // Si no está recargando, se considera una desconexión genuina
          room.removeUser(socket.id);

          // Verificar si la sala quedó vacía
          if (room.isEmpty()) {
            console.log(`Sala ${pin} quedó vacía tras desconexión de ${nickname}`);

            // No eliminamos la sala inmediatamente, permitimos la reconexión
            deletionTimers[pin] = setTimeout(async () => {
              // Verificar si la sala sigue existiendo y vacía después del tiempo de espera
              if (rooms[pin] && rooms[pin].isEmpty()) {
                const activeUsers = await DeviceSession.countDocuments({ roomPin: pin });
                if (activeUsers === 0) {
                  delete rooms[pin];
                  console.log(`Sala ${pin} eliminada por inactividad tras desconexión.`);
                }
              }
              delete deletionTimers[pin];
            }, 300000); // 5 minutos de espera para reconexión
          } else {
            // Notificar a los demás usuarios
            io.to(pin).emit('userLeft', {
              userId: socket.id,
              nickname,
              count: room.users.length,
              limit: room.limit
            });

            // Notificar si queda un solo usuario
            if (room.users.length === 1) {
              const lastUser = room.users[0];
              io.to(lastUser.id).emit('isLastUser', true);
            }
          }
        }
      }
    });
  });
}

module.exports = RoomController;