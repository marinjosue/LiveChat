const Room = require('../models/Room');
const generatePIN = require('../utils/pinGenerator');
const { registerSession, validateSession, removeSession, getSessionByIp } = require('./DeviceSessionController');
const Message = require('../models/Message');
const DeviceSession = require('../models/DeviceSession');
const { uploadToCloudinary } = require('../utils/fileUploader');

const rooms = {};

// variable global para temporizadores de eliminacion de salas
const deletionTimers = {};

// variable para rastrear usuarios en proceso de recarga
const refreshingUsers = new Set();

// funcion auxiliar para obtener ip del cliente
const getClientIp = (socket) => {
  return socket.handshake.headers['x-forwarded-for']?.split(',')[0] || 
         socket.handshake.address || 
         socket.conn.remoteAddress;
};

function RoomController(io) {
  io.on('connection', (socket) => {
    const clientIp = getClientIp(socket);
    console.log(`Nuevo cliente conectado: ${socket.id} desde IP: ${clientIp}`);

    // crear sala
    socket.on('createRoom', async ({ limit, nickname, deviceId }, callback) => {
      try {
        const clientIp = getClientIp(socket);
        
        // validar datos de entrada
        if (!nickname || !deviceId || !limit) {
          return callback({ success: false, message: 'Datos incompletos' });
        }
        
        // validar longitud de nickname (maximo 12 caracteres)
        if (nickname.length > 12) {
          return callback({ success: false, message: 'El nombre no puede exceder 12 caracteres' });
        }
        
        // validar limite de usuarios (maximo 10)
        if (limit > 10 || limit < 2) {
          return callback({ success: false, message: 'El limite debe estar entre 2 y 10 usuarios' });
        }
        
        // verificar si esta ip ya tiene una sesion activa en cualquier sala
        const existingSession = await DeviceSession.findOne({ ip: clientIp });
        if (existingSession) {
          // verificar si la sala de la sesion antigua todavia existe
          const oldRoom = rooms[existingSession.roomPin];
          if (!oldRoom) {
            // la sala ya no existe, limpiar la sesion huerfana
            console.log(`Limpiando sesion huerfana para IP ${clientIp} en sala ${existingSession.roomPin}`);
            await DeviceSession.deleteOne({ ip: clientIp });
          } else {
            return callback({ 
              success: false, 
              message: 'Ya tienes una sesion activa. Cierra la otra sala primero.' 
            });
          }
        }

        // validar maximo de 15 salas activas
        const MAX_ROOMS = 15;
        const activeRoomsCount = Object.keys(rooms).length;

        if (activeRoomsCount >= MAX_ROOMS) {
          return callback({ success: false, message: 'Se ha alcanzado el limite maximo de salas activas (15).' });
        }

        const existingPins = Object.keys(rooms);
        const pin = generatePIN(existingPins);
        const room = new Room(pin, limit);
        rooms[pin] = room;

        await registerSession(deviceId, clientIp, pin, nickname);

        room.addUser(socket.id, nickname, deviceId);
        socket.join(pin);
        socket.clientIp = clientIp;
        socket.userPin = pin;
        socket.userNickname = nickname;

        // al crear la sala se garantiza que no haya temporizador pendiente
        if (deletionTimers[pin]) {
          clearTimeout(deletionTimers[pin]);
          delete deletionTimers[pin];
        }

        console.log(`Sala creada con PIN: ${pin} por ${nickname} (IP: ${clientIp})`);
        io.to(pin).emit('userJoined', { userId: socket.id, nickname, count: room.users.length, limit: room.limit });
        callback({ success: true, pin });
      } catch (err) {
        console.error('Error en createRoom:', err);
        callback({ success: false, message: err.message });
      }
    });

    // unirse a sala
    socket.on('joinRoom', async ({ pin, nickname, deviceId }, callback) => {
      // validar datos de entrada
      if (!pin || !nickname || !deviceId) {
        return callback({ success: false, message: 'Datos incompletos' });
      }
      
      // validar longitud de nickname (maximo 12 caracteres)
      if (nickname.length > 12) {
        return callback({ success: false, message: 'El nombre no puede exceder 12 caracteres' });
      }
      
      const room = rooms[pin];
      if (!room) return callback({ success: false, message: 'PIN invalido.' });
      if (room.isFull()) return callback({ success: false, message: 'La sala esta llena.' });

      try {
        const clientIp = getClientIp(socket);
        
        // verificar si esta ip ya tiene una sesion activa en otra sala
        const existingSession = await DeviceSession.findOne({ ip: clientIp });
        if (existingSession && existingSession.roomPin !== pin) {
          // verificar si la sala antigua todavia existe
          const oldRoom = rooms[existingSession.roomPin];
          if (!oldRoom) {
            // la sala ya no existe, limpiar la sesion huerfana
            console.log(`Limpiando sesion huerfana para IP ${clientIp} en sala ${existingSession.roomPin}`);
            await DeviceSession.deleteOne({ ip: clientIp });
          } else {
            return callback({ 
              success: false, 
              message: 'Ya tienes una sesion activa en otra sala. Cierra esa sala primero.' 
            });
          }
        }

        await registerSession(deviceId, clientIp, pin, nickname);
        room.addUser(socket.id, nickname, deviceId);
        socket.join(pin);
        socket.clientIp = clientIp;
        socket.userPin = pin;
        socket.userNickname = nickname;

        // cancelar cualquier temporizador de eliminacion
        if (deletionTimers[pin]) {
          clearTimeout(deletionTimers[pin]);
          delete deletionTimers[pin];
        }

        const previousMessages = await Message.find({ pin }).sort({ timestamp: 1 });
        console.log(`Cargando ${previousMessages.length} mensajes previos para sala ${pin}`);
        socket.emit('previousMessages', previousMessages);

        io.to(pin).emit('userJoined', { userId: socket.id, nickname, count: room.users.length, limit: room.limit });

        // notificar al cliente si es el unico usuario en la sala
        socket.emit('isLastUser', room.users.length === 1);

        console.log(`${nickname} se unio a sala ${pin} (IP: ${clientIp})`);
        callback({ success: true, pin });
      } catch (err) {
        console.error('Error en joinRoom:', err);
        callback({ success: false, message: err.message });
      }
    });

    // manejar notificacion de recarga de pagina
    socket.on('pageRefreshing', ({ pin, deviceId }) => {
      const key = `${pin}:${deviceId}`;
      refreshingUsers.add(key);
      socket.refreshing = true;
      console.log(`Socket ${socket.id} indica refresh en sala ${pin}`);

      // eliminar de la lista despues de un tiempo prudencial
      setTimeout(() => {
        refreshingUsers.delete(key);
      }, 30000);
    });

    // reconectar a sala
    socket.on('reconnectToRoom', async ({ pin, nickname, deviceId }, callback) => {
      try {
        const clientIp = getClientIp(socket);
        const room = rooms[pin];
        
        if (!room) {
          return callback({ success: false, message: 'Sala no encontrada' });
        }

        // limpiar flag de refreshing
        const key = `${pin}:${deviceId}`;
        refreshingUsers.delete(key);

        // buscar sesion por ip
        const session = await getSessionByIp(clientIp, pin);
        if (!session) {
          return callback({ success: false, message: 'Sesion no valida o expirada' });
        }

        // buscar si el usuario ya existe en la sala con la misma ip
        const existingUserIndex = room.users.findIndex(u => u.id === socket.id);
        
        if (existingUserIndex !== -1) {
          // actualizar el socket id manteniendo el resto de la informacion
          const existingUser = room.users[existingUserIndex];
          
          // si hay un socket antiguo, limpiarlo para evitar duplicados
          if (existingUser.id !== socket.id) {
            const oldSocket = io.sockets.sockets.get(existingUser.id);
            if (oldSocket) {
              oldSocket.leave(pin);
              console.log(`Socket antiguo ${existingUser.id} reemplazado por ${socket.id}`);
            }
          }
          
          // actualizar con el nuevo socket y asegurar nickname de la sesion
          existingUser.id = socket.id;
          existingUser.nickname = session.nickname;
          socket.join(pin);
          socket.clientIp = clientIp;
          socket.userPin = pin;
          socket.userNickname = session.nickname;

          // cargar todos los mensajes previos con sus archivos
          const previousMessages = await Message.find({ pin }).sort({ timestamp: 1 });
          console.log(`Reconexion: Cargando ${previousMessages.length} mensajes para ${session.nickname}`);
          socket.emit('previousMessages', previousMessages);
          
          console.log(`Usuario ${session.nickname} reconectado correctamente (IP: ${clientIp})`);
          return callback({ success: true, pin });
        }

        // si no existe en la sala pero tiene sesion valida, agregar
        if (room.isFull()) {
          return callback({ success: false, message: 'La sala esta llena' });
        }

        // agregar con el nickname de la sesion
        room.addUser(socket.id, session.nickname, deviceId);
        socket.join(pin);
        socket.clientIp = clientIp;
        socket.userPin = pin;
        socket.userNickname = session.nickname;
        
        // cargar todos los mensajes previos con sus archivos
        const previousMessages = await Message.find({ pin }).sort({ timestamp: 1 });
        console.log(`Reconexion: Cargando ${previousMessages.length} mensajes para ${session.nickname}`);
        socket.emit('previousMessages', previousMessages);
          
        // notificar a todos los usuarios de la sala
        io.to(pin).emit('userJoined', {
          userId: socket.id,
          nickname: session.nickname,
          count: room.users.length,
          limit: room.limit
        });

        console.log(`Usuario ${session.nickname} reagregado despues de reconexion (IP: ${clientIp})`);
        callback({ success: true, pin });
      } catch (err) {
        console.error('Error en reconnectToRoom:', err);
        callback({ success: false, message: err.message });
      }
    });

    // enviar mensaje
    socket.on('sendMessage', async ({ pin, text }) => {
      if (!pin || !text || text.trim() === '') {
        console.log('Datos de mensaje invalidos');
        return;
      }
      
      const room = rooms[pin];
      if (!room) {
        console.log('Sala no encontrada:', pin);
        return;
      }

      // usar socket.userNickname directamente
      const sender = socket.userNickname || 'Anonimo';

      console.log(`Mensaje en sala ${pin} de ${sender}: ${text}`);
      io.to(pin).emit('chatMessage', { sender, text });
      
      try {
        await Message.create({ pin, sender, text, messageType: 'text' });
        console.log('Mensaje guardado en BD');
      } catch (err) {
        console.error('Error guardando mensaje:', err);
      }
    });

    // enviar archivo
    socket.on('sendFile', async ({ pin, fileData, fileName, fileType, fileSize, tempId }, callback) => {
      try {
        // validar datos de entrada
        if (!pin || !fileData || !fileName || !fileType || !fileSize) {
          console.log('Datos de archivo incompletos');
          socket.emit('fileError', { message: 'Datos de archivo incompletos', tempId });
          if (callback) callback({ success: false, message: 'Datos de archivo incompletos' });
          return;
        }
        
        // validar que filedata sea base64 valido
        if (!fileData.startsWith('data:')) {
          console.log('Formato de archivo invalido');
          socket.emit('fileError', { message: 'Formato de archivo invalido', tempId });
          if (callback) callback({ success: false, message: 'Formato de archivo invalido' });
          return;
        }
        
        console.log(`Recibiendo archivo: ${fileName} (${fileType}, ${fileSize} bytes) en sala ${pin}`);
        
        const room = rooms[pin];
        if (!room) {
          console.log('Sala no encontrada:', pin);
          socket.emit('fileError', { message: 'Sala no encontrada', tempId });
          if (callback) callback({ success: false, message: 'Sala no encontrada' });
          return;
        }

        // usar socket.userNickname directamente
        const sender = socket.userNickname || 'Anonimo';
        console.log(`Enviado por: ${sender}`);

        // validar tamano (15MB)
        const MAX_SIZE = 15 * 1024 * 1024;
        if (fileSize > MAX_SIZE) {
          console.log('Archivo demasiado grande');
          socket.emit('fileError', { message: 'El archivo supera el limite de 15MB', tempId });
          if (callback) callback({ success: false, message: 'El archivo supera el limite de 15MB' });
          return;
        }

        // determinar tipo de mensaje
        let messageType = 'document';
        if (fileType.startsWith('image/')) messageType = 'image';
        else if (fileType.startsWith('video/')) messageType = 'video';
        else if (fileType.startsWith('audio/')) messageType = 'audio';
        console.log(`Tipo de mensaje: ${messageType}`);

        // subir a cloudinary con reintentos automaticos
        console.log('Subiendo a Cloudinary...');
        const uploadResult = await uploadToCloudinary(fileData, fileName, 'livechat');

        if (!uploadResult.success) {
          console.log('Error al subir a Cloudinary:', uploadResult.error);
          socket.emit('fileError', { message: 'Error al subir el archivo a Cloudinary', tempId });
          if (callback) callback({ success: false, message: 'Error al subir el archivo a Cloudinary' });
          return;
        }
        
        console.log('Subido a Cloudinary:', uploadResult.url);

        // crear mensaje en la base de datos
        console.log('Guardando en base de datos...');
        const message = await Message.create({
          pin,
          sender,
          messageType,
          fileData: {
            url: uploadResult.url,
            publicId: uploadResult.publicId,
            originalName: fileName,
            mimeType: fileType,
            size: fileSize,
            thumbnail: uploadResult.thumbnail,
            width: uploadResult.width,
            height: uploadResult.height
          }
        });
        console.log('Mensaje guardado en BD');

        // emitir a todos en la sala
        console.log(`Emitiendo fileMessage a sala ${pin}`);
        io.to(pin).emit('fileMessage', {
          sender,
          messageType,
          fileData: message.fileData,
          timestamp: message.timestamp,
          tempId
        });
        
        // confirmar al emisor que se proceso correctamente
        socket.emit('fileSuccess', { tempId, success: true });
        
        // confirmar recepcion al cliente via callback
        if (callback) {
          callback({ success: true, message: 'Archivo procesado correctamente' });
        }
        
        console.log('Archivo procesado y enviado correctamente');

      } catch (error) {
        console.error('Error al procesar archivo:', error);
        socket.emit('fileError', { message: 'Error al procesar el archivo', tempId });
        if (callback) callback({ success: false, message: 'Error al procesar el archivo' });
      }
    });

    // cargar mensaje 
    socket.on('requestPreviousMessages', async ({ pin }) => {
      const previousMessages = await Message.find({ pin }).sort({ timestamp: 1 });
      socket.emit('previousMessages', previousMessages);
    });

    // funcion auxiliar para manejar salas vacias
    const handleEmptyRoom = async (pin) => {
      const messageCount = await Message.countDocuments({ pin });
      if (messageCount === 0) {
        // si no hay mensajes, eliminar la sala
        await DeviceSession.deleteMany({ roomPin: pin });
        delete rooms[pin];
        console.log(`Sala ${pin} eliminada por estar vacia y sin mensajes`);
      } else {
        // si hay mensajes, mantener la sala por un tiempo
        deletionTimers[pin] = setTimeout(async () => {
          const activeUsers = await DeviceSession.countDocuments({ roomPin: pin });
          if (activeUsers === 0) {
            await Message.deleteMany({ pin });
            await DeviceSession.deleteMany({ roomPin: pin });
            delete rooms[pin];
            console.log(`Sala ${pin} eliminada despues del periodo de inactividad`);
          }
        }, 3600000);
      }
    };

    // marcar salida intencional (no recarga de pagina)
    socket.on('intentionalLeave', ({ pin }) => {
      const key = `${pin}:${socket.id}`;
      socket.intentionalLeave = true;
      console.log(`Usuario marcado como salida intencional en sala ${pin}`);
    });

    // salir de sala
    socket.on('leaveRoom', async ({ pin, deviceId }, callback) => {
      console.log(`leaveRoom recibido - PIN: ${pin}, Socket: ${socket.id}`);
      
      const room = rooms[pin];
      if (!room) {
        console.log(`Sala ${pin} no encontrada`);
        if (callback) callback({ success: true, message: 'Sala no encontrada' });
        return;
      }

      const clientIp = socket.clientIp || getClientIp(socket);
      const user = room.users.find(u => u.id === socket.id);
      const nickname = user ? user.nickname : 'Desconocido';
      
      console.log(`Usuario ${nickname} saliendo de sala ${pin} (IP: ${clientIp})`);
      
      // marcar como salida intencional
      socket.intentionalLeave = true;
      
      room.removeUser(socket.id);
      socket.leave(pin);

      try {
        // verificar sesion antes de eliminar
        const sessionBefore = await DeviceSession.findOne({ ip: clientIp, roomPin: pin });
        console.log(`Sesion encontrada antes de eliminar:`, sessionBefore ? 'SI' : 'NO');
        
        // eliminar sesion por ip
        const result = await removeSession(deviceId, clientIp, pin);
        console.log(`Sesion eliminada completamente para ${nickname} (IP: ${clientIp}) de sala ${pin}`);
        
        // verificar que se elimino
        const sessionAfter = await DeviceSession.findOne({ ip: clientIp, roomPin: pin });
        console.log(`Sesion despues de eliminar:`, sessionAfter ? 'TODAVIA EXISTE' : 'ELIMINADA');
      } catch (err) {
        console.error(`Error eliminando sesion:`, err);
      }

      if (room.isEmpty()) {
        await handleEmptyRoom(pin);
      } else {
        io.to(pin).emit('userLeft', { userId: socket.id, nickname, count: room.users.length, limit: room.limit });
      }

      if (callback) callback({ success: true, message: 'Sesion eliminada correctamente' });
    });

    // desconexion
    socket.on('disconnect', async () => {
      const clientIp = socket.clientIp || getClientIp(socket);
      console.log(`Cliente desconectado: ${socket.id} (IP: ${clientIp})`);

      // si fue una salida intencional, no hacer nada mas (ya se manejo en leaveRoom)
      if (socket.intentionalLeave) {
        console.log(`Desconexion intencional, sesion ya eliminada`);
        return;
      }

      // buscar en todas las salas si el usuario esta conectado
      for (const pin in rooms) {
        const room = rooms[pin];
        const userIndex = room.users.findIndex(u => u.id === socket.id);

        if (userIndex !== -1) {
          const user = room.users[userIndex];
          const nickname = user.nickname || 'Desconocido';
          const deviceId = user.deviceId;

          // verificar si esta en proceso de recarga
          const isRefreshing = refreshingUsers.has(`${pin}:${deviceId}`) || socket.refreshing;
          
          if (isRefreshing) {
            console.log(`Usuario ${nickname} esta recargando pagina, no se elimina`);
            continue;
          }

          // verificar sesion por ip
          try {
            const session = await getSessionByIp(clientIp, pin);
            
            if (session) {
              console.log(`Sesion valida para IP ${clientIp}, esperando para confirmar desconexion real`);
              
              // esperar un poco para confirmar que es desconexion real y no recarga
              setTimeout(async () => {
                // verificar nuevamente si el usuario se ha reconectado
                const stillExists = rooms[pin]?.users.some(u => u.id === socket.id);
                
                if (stillExists) {
                  console.log(`Usuario ${nickname} se ha reconectado, no se elimina`);
                  return;
                }
                
                // si no se reconecto, proceder con la eliminacion
                console.log(`Confirmada desconexion real de ${nickname}, eliminando...`);
                room.removeUser(socket.id);
                await removeSession(deviceId, clientIp, pin);
                
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
              }, 5000);
              
              continue;
            }
          } catch (err) {
            console.error('Error verificando sesion en desconexion:', err);
          }

          // eliminacion inmediata si no hay sesion valida
          room.removeUser(socket.id);
          await removeSession(deviceId, clientIp, pin);

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
