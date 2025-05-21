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

    // Primero buscar si existe una sesión válida para este dispositivo
    const isValidSession = await validateSession(deviceId, pin);
    if (!isValidSession) {
      return callback({ success: false, message: 'Sesión no válida o expirada' });
    }

    // Buscar si el usuario ya existe en la sala con el mismo deviceId
    const existingUserIndex = room.users.findIndex(u => u.deviceId === deviceId);
    
    if (existingUserIndex !== -1) {
      // Actualizar el socket ID manteniendo el resto de la información
      const existingUser = room.users[existingUserIndex];
      
      // Si hay un socket antiguo, limpiarlo para evitar duplicados
      if (existingUser.id !== socket.id) {
        const oldSocket = io.sockets.sockets.get(existingUser.id);
        if (oldSocket) {
          oldSocket.leave(pin);
          console.log(`Socket antiguo ${existingUser.id} reemplazado por ${socket.id}`);
        }
      }
      
      // Actualizar con el nuevo socket
      existingUser.id = socket.id;
      socket.join(pin);

      // Cargar mensajes previos
      const previousMessages = await Message.find({ pin })
          .sort({ timestamp: 1 })
          .select('sender text timestamp');

      socket.emit('previousMessages', previousMessages);
      
      // Notificar manteniendo el conteo actual
      io.to(pin).emit('userJoined', {
          userId: socket.id,
          nickname: existingUser.nickname,
          count: room.users.length,
          limit: room.limit
      });

      console.log(`Usuario ${nickname} reconectado correctamente con dispositivo ${deviceId}`);
      return callback({ success: true, pin });
    }

    // Si no existe el usuario pero la sesión es válida y hay espacio, agregarlo
    if (room.isFull()) {
      return callback({ success: false, message: 'La sala está llena' });
    }

    // Agregar como nuevo usuario
    room.addUser(socket.id, nickname, deviceId);
    socket.join(pin);
    
    // Cargar mensajes previos
    const previousMessages = await Message.find({ pin })
      .sort({ timestamp: 1 })
      .select('sender text timestamp');

    socket.emit('previousMessages', previousMessages);
      
    // Notificar a todos los usuarios de la sala
    io.to(pin).emit('userJoined', {
      userId: socket.id,
      nickname,
      count: room.users.length,
      limit: room.limit
    });

    callback({ success: true, pin });
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
    socket.on('leaveRoom', async ({ pin, deviceId, ip }, callback) => {
      const room = rooms[pin];
      if (!room) return;

      const user = room.users.find(u => u.id === socket.id);
      const nickname = user ? user.nickname : 'Desconocido';
      room.removeUser(socket.id);
      socket.leave(pin);

      try {
        // Elimina todas las sesiones asociadas a ese deviceId o IP
        const deleted = await DeviceSession.deleteMany({
          $or: [
            { deviceId },
            { deviceId: ip }
          ]
        });

        if (deleted.deletedCount === 0) {
          console.warn(`No se encontró ninguna sesión para eliminar con deviceId: ${deviceId} ni IP: ${ip}`);
        } else {
          console.log(`Sesiones eliminadas correctamente para ${deviceId} o IP: ${ip}`);
        }
      } catch (err) {
        console.error(`Error eliminando sesión:`, err);
      }

      if (room.isEmpty()) {
        await handleEmptyRoom(pin);
      } else {
        io.to(pin).emit('userLeft', { userId: socket.id, nickname, count: room.users.length, limit: room.limit });
      }

      if (callback) callback();
    });

    // Desconexión
   socket.on('disconnect', async () => {
  console.log(`Cliente desconectado: ${socket.id}`);

  // Buscar en todas las salas si el usuario está conectado
  for (const pin in rooms) {
    const room = rooms[pin];
    const userIndex = room.users.findIndex(u => u.id === socket.id);

    if (userIndex !== -1) {
      const user = room.users[userIndex];
      const nickname = user.nickname || 'Desconocido';
      const deviceId = user.deviceId;

      // Verificar si hay una sesión válida para este dispositivo antes de removerlo
      try {
        const isValidSession = await validateSession(deviceId, pin);
        const isRefreshing = refreshingUsers.has(`${pin}:${deviceId}`);
        
        // No eliminar usuario si está en proceso de recarga o tiene sesión válida reciente
        if (isRefreshing || socket.refreshing) {
          console.log(`Usuario ${nickname} con dispositivo ${deviceId} está recargando, no se elimina`);
          continue;
        }
        
        // Si la sesión es válida pero no está marcado como refresh, esperar brevemente
        if (isValidSession) {
          console.log(`Sesión válida para ${deviceId}, esperando para confirmar desconexión real`);
          
          // Esperar un poco para confirmar que es desconexión real y no recarga
          setTimeout(async () => {
            // Verificar nuevamente si el usuario se ha reconectado
            const stillExists = rooms[pin]?.users.some(u => u.deviceId === deviceId);
            
            if (stillExists) {
              console.log(`Usuario ${deviceId} se ha reconectado, no se elimina`);
              return;
            }
            
            // Si no se reconectó, proceder con la eliminación
            console.log(`Confirmada desconexión real de ${nickname}, eliminando...`);
            const userStillExists = room.removeUser(socket.id);
            
            if (!userStillExists && room.isEmpty()) {
              handleEmptyRoom(pin);
            } else {
              io.to(pin).emit('userLeft', {
                userId: socket.id,
                nickname,
                count: room.users.length,
                limit: room.limit
              });
            }
          }, 5000); // Esperar 5 segundos para confirmar
          
          continue;
        }
      } catch (err) {
        console.error('Error verificando sesión en desconexión:', err);
      }

      // Eliminación normal si no hay condiciones especiales
      room.removeUser(socket.id);

      if (room.isEmpty()) {
        handleEmptyRoom(pin);
      } else {
        io.to(pin).emit('userLeft', {
          userId: socket.id,
          nickname,
          count: room.users.length,
          limit: room.limit
        });
      }
    }
  }
});
  });
}

module.exports = RoomController;