const Room = require('../models/Room');
const RoomModel = require('../models/RoomModel');
const generatePIN = require('../utils/pinGenerator');
const { registerSession, validateSession, removeSession, getSessionByIp } = require('./DeviceSessionController');
const Message = require('../models/Message');
const DeviceSession = require('../models/DeviceSession');
const RoomMembership = require('../models/RoomMembership');
const { uploadToCloudinary } = require('../utils/fileUploader');
const { FileSecurityService } = require('../services/fileSecurityService');
const { AuditService } = require('../services/auditService');
const { InactivityService } = require('../services/inactivityService');
const { UserPrivacyService } = require('../services/userPrivacyService');
const { encryptionService } = require('../services/encryptionService');

const rooms = {};

// variable global para temporizadores de eliminacion de salas
const deletionTimers = {};
// variable para rastrear usuarios en proceso de recarga
const refreshingUsers = new Set();
// Servicio de inactividad (se inicializa en RoomController)
let inactivityService = null;
// funcion auxiliar para obtener ip del cliente
const getClientIp = (socket) => {
  const ip = socket.handshake.headers['x-forwarded-for']?.split(',')[0] || 
             socket.handshake.address || 
             socket.conn.remoteAddress;
  
  // Limpiar la IP si viene con ::ffff:
  const cleanIp = ip.replace('::ffff:', '');
  console.log(`📍 IP detectada - Original: ${ip}, Limpia: ${cleanIp}`);
  return cleanIp;
};

// Función auxiliar para emitir la lista actualizada de usuarios
const emitUserList = (pin, room, io) => {
  if (!room) return;
  
  // Generar lista de usuarios con información hasheada para privacidad
  const userList = room.users.map(user => ({
    socketId: user.id,
    nickname: user.nickname,
    deviceId: user.deviceId,
    joinedAt: user.joinedAt || new Date()
  }));

  // Emitir a cada usuario su propia versión de la lista
  room.users.forEach(user => {
    const socket = io.sockets.sockets.get(user.id);
    if (socket) {
      const anonymousUserList = UserPrivacyService.generateAnonymousUserList(
        userList,
        pin,
        user.nickname // El usuario actual verá "Tú" en lugar de su hash
      );
      
      socket.emit('userListUpdate', {
        users: anonymousUserList,
        totalCount: room.users.length,
        maxParticipants: room.limit
      });
    }
  });
};

function RoomController(io) {
  // Inicializar servicio de inactividad
  if (!inactivityService) {
    inactivityService = new InactivityService(io);
    inactivityService.start();
    console.log('InactivityService inicializado');
  }

  io.on('connection', (socket) => {
    const clientIp = getClientIp(socket);
    console.log(`Nuevo cliente conectado: ${socket.id} desde IP: ${clientIp}`);

    // crear sala - DESHABILITADO (solo admin puede crear salas)
    socket.on('createRoom', async ({ limit, nickname, deviceId, type, name }, callback) => {
      return callback({ 
        success: false, 
        message: 'Solo los administradores pueden crear salas. Por favor, únete a una sala existente.' 
      });
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
      
      let room = rooms[pin];
      
      // Si la sala no está en memoria, buscar en MongoDB
      if (!room) {
        try {
          const roomDocument = await RoomModel.findOne({ pin: pin, isActive: true });
          if (roomDocument) {
            // Cargar sala desde MongoDB a memoria
            room = new Room(
              roomDocument.pin, 
              roomDocument.maxParticipants, 
              roomDocument.roomType, 
              roomDocument.name
            );
            rooms[pin] = room;
            console.log(`Sala ${pin} cargada desde MongoDB a memoria`);
          }
        } catch (dbError) {
          console.error('Error buscando sala en MongoDB:', dbError);
        }
      }
      
      if (!room) return callback({ success: false, message: 'PIN invalido.' });
      if (room.isFull()) return callback({ success: false, message: 'La sala esta llena.' });

      try {
        const clientIp = getClientIp(socket);
        
        console.log(`Cliente intentando unirse: IP=${clientIp}, PIN=${pin}, deviceId=${deviceId}`);
        
        //  VALIDACIÓN: Una IP = Un dispositivo = Una sala ÚNICA = Una conexión activa
        const existingSessions = await DeviceSession.find({ ipAddress: clientIp });
        console.log(`📋 Sesiones encontradas para IP ${clientIp}:`, existingSessions.length);
        
        for (const session of existingSessions) {
          console.log(`  - Sesión: PIN=${session.pin}, deviceId=${session.deviceId}, nickname=${session.nickname}`);
        }
        
        // Si hay alguna sesión activa
        if (existingSessions.length > 0) {
          // Verificar si todas las sesiones son de la MISMA sala
          const uniqueRooms = [...new Set(existingSessions.map(s => s.pin))];
          
          if (uniqueRooms.length > 1) {
            // ERROR CRÍTICO: Múltiples salas para una misma IP (no debería pasar)
            console.error(`ERROR CRÍTICO: IP ${clientIp} tiene sesiones en ${uniqueRooms.length} salas diferentes:`, uniqueRooms);
            
            // Limpiar todas las sesiones y forzar reconexión
            await DeviceSession.deleteMany({ ip: clientIp });
            console.log(`Sesiones limpiadas. Usuario debe reconectar.`);
            
            return callback({ 
              success: false, 
              message: `Sesiones inconsistentes detectadas. Por favor, intenta de nuevo.` 
            });
          }
          
          // Todas las sesiones son de una misma sala
          const existingRoomPin = uniqueRooms[0];
          
          if (existingRoomPin !== pin) {
            // Dispositivo intenta acceder a OTRA sala diferente
            console.log(`BLOQUEADO: IP ${clientIp} ya tiene sesión activa en sala ${existingRoomPin}`);
            return callback({ 
              success: false, 
              message: `Este dispositivo ya está conectado a la sala ${existingRoomPin}.\n\n⚠️ Debes salir de esa sala antes de unirte a otra.\n\nSolo puedes estar en UNA sala a la vez.` 
            });
          }
          
          //  VERIFICACIÓN CRÍTICA: Bloquear múltiples pestañas/ventanas
          let activeUsersInRoom = [];
          // Solo verificar si la sala tiene usuarios cargados
          if (room && room.users && room.users.length > 0) {
            activeUsersInRoom = room.users.filter(u => {
              const userSocket = io.sockets.sockets.get(u.id);
              if (!userSocket) return false;
              const userIp = getClientIp(userSocket);
              return userIp === clientIp;
            });
          }
          
          // Verificación adicional: buscar en TODOS los sockets conectados
          const allConnectedSockets = Array.from(io.sockets.sockets.values());
          const socketsWithSameIp = allConnectedSockets.filter(s => {
            return s.userPin === pin && getClientIp(s) === clientIp && s.id !== socket.id;
          });
          
          if (activeUsersInRoom.length > 0 || socketsWithSameIp.length > 0) {
            // Ya hay una conexión activa desde esta IP en esta sala
            console.log(`BLOQUEADO: IP ${clientIp} ya tiene conexión(es) activa(s) en sala ${pin}`);
            console.log(`   Usuarios en room.users:`, activeUsersInRoom.map(u => u.id));
            console.log(`   Sockets conectados con misma IP:`, socketsWithSameIp.map(s => s.id));
            console.log(`   Nuevo intento desde socket: ${socket.id}`);
            
            return callback({ 
              success: false, 
              message: `Ya tienes una pestaña/ventana conectada a esta sala.\n\n⚠️ Solo puedes tener UNA conexión activa por dispositivo.\n\nCierra las otras pestañas primero.` 
            });
          }
          // Limpiar sesiones antiguas y crear una nueva para este socket
          await DeviceSession.deleteMany({ ipAddress: clientIp, pin: pin });
          console.log(` Sesiones antiguas limpiadas para IP ${clientIp}`);
        } else {
          // No hay sesiones activas - NUEVA CONEXIÓN PERMITIDA
          console.log(`IP ${clientIp} sin sesiones activas - permitiendo acceso a sala ${pin}`);
        }

        await registerSession(deviceId, clientIp, pin, nickname);
        room.addUser(socket.id, nickname, deviceId);
        socket.join(pin);
        socket.clientIp = clientIp;
        socket.userPin = pin;
        socket.userNickname = nickname;

        // CREAR O ACTUALIZAR ROOM MEMBERSHIP
        try {
          await RoomMembership.createOrUpdate(deviceId, nickname, pin, clientIp);
        } catch (membershipError) {
          console.error(' Error creando RoomMembership:', membershipError);
        }

        //  ACTUALIZAR CONTADOR EN MONGODB
        try {
          const roomDocument = await RoomModel.findOne({ pin: pin });
          if (roomDocument) {
            await roomDocument.incrementParticipants();
          }
        } catch (dbError) {
          console.error('Error actualizando participantes en MongoDB:', dbError);
        }

        // cancelar cualquier temporizador de eliminacion
        if (deletionTimers[pin]) {
          clearTimeout(deletionTimers[pin]);
          delete deletionTimers[pin];
        }

        // CARGAR MENSAJES PREVIOS INMEDIATAMENTE (antes de emitir userJoined)
        const previousMessages = await Message.find({ pin }).sort({ timestamp: 1 });
        console.log(`Cargando ${previousMessages.length} mensajes previos para ${nickname} en sala ${pin}`);
        
        // DESCIFRAR mensajes de texto antes de enviar
        const decryptedMessages = previousMessages.map(msg => {
          const messageObj = msg.toObject();
          
          // Solo descifrar mensajes de texto que estén cifrados
          if (messageObj.messageType === 'text' && messageObj.encrypted && messageObj.text) {
            try {
              const decryptionResult = encryptionService.decryptMessage(messageObj.text, { 
                pin: messageObj.pin, 
                sender: messageObj.sender 
              });
              
              if (decryptionResult.success) {
                messageObj.text = decryptionResult.plaintext;
              } else {
                console.error(' Error descifrando mensaje:', decryptionResult.error);
                messageObj.text = '[Mensaje cifrado - error al descifrar]';
              }
            } catch (err) {
              console.error('Excepción descifrando mensaje:', err);
              messageObj.text = '[Mensaje cifrado - error al descifrar]';
            }
          }
          
          return messageObj;
        });
        
        socket.emit('previousMessages', decryptedMessages);

        // EMITIR userJoined CON CONTEO ACTUALIZADO A TODA LA SALA
        io.to(pin).emit('userJoined', { userId: socket.id, nickname, count: room.users.length, limit: room.limit });
        
        // EMITIR participantCountUpdate A TODA LA SALA (nuevo evento específico)
        io.to(pin).emit('participantCountUpdate', { 
          count: room.users.length, 
          limit: room.limit,
          isLastUser: room.users.length === 1
        });

        // notificar al cliente si es el unico usuario en la sala
        socket.emit('isLastUser', room.users.length === 1);

        // Registrar actividad inicial del usuario
        inactivityService.updateActivity(socket.id, pin, deviceId, clientIp);

        console.log(`${nickname} se unio a sala ${pin} (IP: ${clientIp})`);
        console.log(`Tipo de sala: ${room.roomType}`);
        
        // Emitir lista actualizada de usuarios a todos en la sala (DESPUÉS de confirmar éxito)
        setTimeout(() => {
          emitUserList(pin, room, io);
        }, 100);
        
        callback({ success: true, pin, roomType: room.roomType });
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

      // eliminar de la lista despues de un tiempo prudencial (60 segundos)
      setTimeout(() => {
        refreshingUsers.delete(key);
      }, 60000);
    });

    // reconectar a sala
    socket.on('reconnectToRoom', async ({ pin, nickname, deviceId }, callback) => {
      try {
        const clientIp = getClientIp(socket);
        let room = rooms[pin];
        
        // Si la sala no está en memoria, buscar en MongoDB
        if (!room) {
          try {
            const roomDocument = await RoomModel.findOne({ pin: pin, isActive: true });
            if (roomDocument) {
              // Cargar sala desde MongoDB a memoria
              room = new Room(
                roomDocument.pin, 
                roomDocument.maxParticipants, 
                roomDocument.roomType, 
                roomDocument.name
              );
              rooms[pin] = room;
              console.log(`Sala ${pin} cargada desde MongoDB a memoria (reconnect)`);
            }
          } catch (dbError) {
            console.error('Error buscando sala en MongoDB:', dbError);
          }
        }
        
        if (!room) {
          return callback({ success: false, message: 'Sala no encontrada' });
        }

        // limpiar flag de refreshing
        const key = `${pin}:${deviceId}`;
        refreshingUsers.delete(key);

        // BUSCAR SESIÓN POR IP O DEVICEID (intentar ambos métodos)
        let session = await getSessionByIp(clientIp, pin);
        
        if (!session) {
          // Intentar buscar por deviceId como fallback
          session = await DeviceSession.findOne({ deviceId, pin: pin });
        }
        
        // Si no hay sesión pero hay un membership activo, recrear la sesión
        if (!session) {
          const membership = await RoomMembership.findOne({ 
            $or: [
              { deviceId, roomPin: pin },
              { ip: clientIp, roomPin: pin }
            ]
          });
          
          if (membership) {
            // Recrear sesión desde el membership
            console.log(`Recreando sesion desde membership para ${membership.nickname}`);
            await registerSession(deviceId, clientIp, pin, membership.nickname);
            session = await getSessionByIp(clientIp, pin);
          }
        }
        
        if (!session) {
          console.log(`No hay sesión válida para IP ${clientIp} / deviceId ${deviceId} en sala ${pin}`);
          return callback({ success: false, message: 'Sesion no valida o expirada para este dispositivo' });
        }

        console.log(`Sesión encontrada para IP ${clientIp}: ${session.nickname} en sala ${pin}`);

        // buscar si el usuario ya existe en la sala
        const existingUserIndex = room.users.findIndex(u => u.deviceId === deviceId);
        
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
          
          // DESCIFRAR mensajes de texto antes de enviar
          const decryptedMessages = previousMessages.map(msg => {
            const messageObj = msg.toObject();
            
            if (messageObj.messageType === 'text' && messageObj.encrypted && messageObj.text) {
              try {
                const decryptionResult = encryptionService.decryptMessage(messageObj.text, { 
                  pin: messageObj.pin, 
                  sender: messageObj.sender 
                });
                
                if (decryptionResult.success) {
                  messageObj.text = decryptionResult.plaintext;
                } else {
                  messageObj.text = '[Mensaje cifrado - error al descifrar]';
                }
              } catch (err) {
                messageObj.text = '[Mensaje cifrado - error al descifrar]';
              }
            }
            
            return messageObj;
          });
          
          socket.emit('previousMessages', decryptedMessages);
          
          // Registrar actividad y cancelar desconexión pendiente
          if (inactivityService) {
            inactivityService.updateActivity(socket.id, pin, deviceId, clientIp);
            inactivityService.cancelDisconnection(socket.id);
          }

          // Emitir lista actualizada de usuarios
          emitUserList(pin, room, io);
          
          console.log(`Usuario ${session.nickname} reconectado correctamente (IP: ${clientIp})`);
          return callback({ success: true, pin, roomType: room.roomType });
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
        
        // RECONECTAR ROOM MEMBERSHIP
        try {
          // Buscar por IP ya que el deviceId puede haber cambiado
          const membership = await RoomMembership.findOne({ ip: clientIp, roomPin: pin });
          if (membership) {
            membership.deviceId = deviceId; // Actualizar deviceId
            await membership.reconnect();
            console.log(`RoomMembership reconectado para ${session.nickname} en sala ${pin}`);
          } else {
            // Si no existe, crearlo
            await RoomMembership.createOrUpdate(deviceId, session.nickname, pin, clientIp);
            console.log(`RoomMembership creado para ${session.nickname} en sala ${pin}`);
          }
        } catch (membershipError) {
          console.error('Error reconectando RoomMembership:', membershipError);
        }
        
        // cargar todos los mensajes previos con sus archivos
        const previousMessages = await Message.find({ pin }).sort({ timestamp: 1 });
        console.log(`Reconexion: Cargando ${previousMessages.length} mensajes para ${session.nickname}`);
        
        // DESCIFRAR mensajes de texto antes de enviar
        const decryptedMessages = previousMessages.map(msg => {
          const messageObj = msg.toObject();
          
          if (messageObj.messageType === 'text' && messageObj.encrypted && messageObj.text) {
            try {
              const decryptionResult = encryptionService.decryptMessage(messageObj.text, { 
                pin: messageObj.pin, 
                sender: messageObj.sender 
              });
              
              if (decryptionResult.success) {
                messageObj.text = decryptionResult.plaintext;
              } else {
                messageObj.text = '[Mensaje cifrado - error al descifrar]';
              }
            } catch (err) {
              messageObj.text = '[Mensaje cifrado - error al descifrar]';
            }
          }
          
          return messageObj;
        });
        
        socket.emit('previousMessages', decryptedMessages);
          
        // notificar a todos los usuarios de la sala
        io.to(pin).emit('userJoined', {
          userId: socket.id,
          nickname: session.nickname,
          count: room.users.length,
          limit: room.limit
        });

        // Registrar actividad
        if (inactivityService) {
          inactivityService.updateActivity(socket.id, pin, deviceId);
        }

        // Emitir lista actualizada de usuarios
        emitUserList(pin, room, io);
        callback({ success: true, pin, roomType: room.roomType });
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
        return;
      }
      // usar socket.userNickname directamente
      const sender = socket.userNickname || 'Anonimo';

      // Actualizar actividad del usuario
      const user = room.users.find(u => u.id === socket.id);
      if (user) {
        const clientIp = socket.clientIp || getClientIp(socket);
        inactivityService.updateActivity(socket.id, pin, user.deviceId, clientIp);
      }
      // Enviar mensaje en texto plano a la sala (Socket.IO ya usa TLS/SSL)
      io.to(pin).emit('chatMessage', { sender, text });
      
      try {
        // CIFRAR mensaje antes de guardar en BD
        const encryptionResult = encryptionService.encryptMessage(text, { pin, sender });
        
        if (!encryptionResult.success) {
          // Guardar sin cifrar como fallback (mejor que perder el mensaje)
          await Message.create({ pin, sender, text, messageType: 'text', encrypted: false });
        } else {
          // Guardar mensaje cifrado
          await Message.create({ 
            pin, 
            sender, 
            text: encryptionResult.ciphertext, // Texto cifrado en base64
            messageType: 'text',
            encrypted: true
          });
          console.log('🔐 Mensaje cifrado y guardado en BD');
        }
      } catch (err) {
        console.error('Error guardando mensaje:', err);
      }
    });

    // enviar archivo
    // enviar archivo CON ANÁLISIS DE ESTEGANOGRAFÍA
    socket.on('sendFile', async ({ pin, fileData, fileName, fileType, fileSize, tempId }, callback) => {
      try {
        // ===== 1. VALIDAR DATOS DE ENTRADA =====
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
        
        console.log(`[SOCKET] Recibiendo archivo: ${fileName} (${fileType}, ${fileSize} bytes) en sala ${pin}`);
        
        const room = rooms[pin];
        if (!room) {
          console.log('Sala no encontrada:', pin);
          socket.emit('fileError', { message: 'Sala no encontrada', tempId });
          if (callback) callback({ success: false, message: 'Sala no encontrada' });
          return;
        }

        // Validar tipo de sala (multimedia vs text)
        const roomDocument = await RoomModel.findOne({ pin, isActive: true });
        if (!roomDocument) {
          socket.emit('fileError', { message: 'Sala no encontrada en base de datos', tempId });
          if (callback) callback({ success: false, message: 'Sala no encontrada en base de datos' });
          return;
        }

        if (roomDocument.roomType === 'text') {
          socket.emit('fileError', { message: 'Esta sala es solo para mensajes de texto. No se permiten archivos multimedia.', tempId });
          if (callback) callback({ success: false, message: 'Esta sala es solo para mensajes de texto' });
          return;
        }

        // usar socket.userNickname directamente
        const sender = socket.userNickname || 'Anonimo';
        console.log(`Enviado por: ${sender}`);

        // ===== 2. VALIDAR TAMAÑO =====
        const MAX_SIZE = 25 * 1024 * 1024;
        if (fileSize > MAX_SIZE) {
          console.log('Archivo demasiado grande');
          socket.emit('fileError', { message: 'El archivo supera el limite de 25MB', tempId });
          if (callback) callback({ success: false, message: 'El archivo supera el limite de 25MB' });
          return;
        }

        // ===== 3. CONVERTIR BASE64 A BUFFER PARA ANÁLISIS =====
        let fileBuffer;
        try {
          const base64String = fileData.split(',')[1];
          fileBuffer = Buffer.from(base64String, 'base64');
          console.log(`Buffer creado: ${fileBuffer.length} bytes`);
        } catch (error) {
          console.error('Error al convertir base64 a buffer:', error);
          socket.emit('fileError', { message: 'Error al procesar el archivo', tempId });
          if (callback) callback({ success: false, message: 'Error al procesar el archivo' });
          return;
        }

        // ===== 4. ANÁLISIS DE SEGURIDAD (ESTEGANOGRAFÍA) =====
        console.log(`[SECURITY] Analizando archivo para esteganografía: ${fileName}`);
        
        const securityValidation = await FileSecurityService.validateFile(
          fileBuffer,
          fileType,
          fileName,
          {
            checkSteganography: true,
            checkIntegrity: true,
            checkFileType: true,
            maxSize: 25 * 1024 * 1024
          }
        );

        // ===== 5. EVALUAR RESULTADO DEL ANÁLISIS =====
      if (!securityValidation.isValid) {
        console.error(`[SECURITY] Archivo rechazado: ${securityValidation.errors.join(', ')}`);
        
        // Verificar si es por esteganografía
        const isSteganography = securityValidation.checks.steganography?.isSuspicious || false;
        const stegoReasons = securityValidation.checks.steganography?.reasons || [];
        const stegoConfidence = securityValidation.checks.steganography?.confidence || 0;
        
        // Registrar rechazo en auditoría
        await AuditService.logFileRejected(
          null,
          {
            fileName,
            fileSize,
            fileType,
            method: 'socket.io',
            isSteganography,
            confidence: stegoConfidence
          },
          securityValidation.errors.join(', '),
          socket.handshake.address
        );

        // Emitir error con información de esteganografía si aplica
        socket.emit('fileError', {
          message: isSteganography ? 'Archivo rechazado - Contenido sospechoso detectado' : 'Archivo rechazado por razones de seguridad',
          isSuspicious: isSteganography,
          reasons: isSteganography ? stegoReasons : securityValidation.errors,
          confidence: Math.round(stegoConfidence * 100),
          errors: securityValidation.errors,
          warnings: securityValidation.warnings,
          tempId
        });
        
        if (callback) {
          callback({
            success: false,
            message: isSteganography ? 'Archivo rechazado - Contenido sospechoso detectado' : 'Archivo rechazado por razones de seguridad',
            isSuspicious: isSteganography,
            reasons: isSteganography ? stegoReasons : securityValidation.errors,
            confidence: Math.round(stegoConfidence * 100),
            errors: securityValidation.errors
          });
        }
        
        return;
      }        // ===== 6. REGISTRAR ADVERTENCIAS (Si hay esteganografía sospechosa) =====
        if (securityValidation.warnings.length > 0) {
          console.warn(`[SECURITY] Advertencias detectadas: ${securityValidation.warnings.join(', ')}`);
          
          await AuditService.logSteganographyDetected(
            null,
            {
              fileName,
              fileSize,
              fileType,
              method: 'socket.io',
              reason: securityValidation.warnings.join(', ')
            },
            socket.handshake.address
          );

          // Notificar a admins en tiempo real
          io.emit('steganography-warning', {
            fileName,
            sender,
            pin,
            warnings: securityValidation.warnings,
            confidence: securityValidation.checks.steganography?.confidence || 0,
            timestamp: new Date()
          });
        }

        // ===== 7. DETERMINAR TIPO DE MENSAJE =====
        let messageType = 'document';
        if (fileType.startsWith('image/')) messageType = 'image';
        else if (fileType.startsWith('video/')) messageType = 'video';
        else if (fileType.startsWith('audio/')) messageType = 'audio';
        console.log(`Tipo de mensaje: ${messageType}`);

        // ===== 8. SUBIR A CLOUDINARY =====
        console.log('Subiendo a Cloudinary...');
        const uploadResult = await uploadToCloudinary(fileData, fileName, 'livechat');

        if (!uploadResult.success) {
          console.log('Error al subir a Cloudinary:', uploadResult.error);
          socket.emit('fileError', { message: 'Error al subir el archivo a Cloudinary', tempId });
          if (callback) callback({ success: false, message: 'Error al subir el archivo a Cloudinary' });
          return;
        }
        
        console.log('Subido a Cloudinary:', uploadResult.url);

        // ===== 9. GUARDAR MENSAJE EN BD CON INFO DE SEGURIDAD =====
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
          },
          securityCheck: {
            steganographyAnalyzed: true,
            isSuspicious: securityValidation.checks.steganography?.isSuspicious || false,
            suspiciousReasons: securityValidation.checks.steganography?.reasons || [],
            analysisTimestamp: new Date()
          }
        });
        console.log('Mensaje guardado en BD con info de seguridad');

        // ===== 10. EMITIR A TODOS EN LA SALA =====
        console.log(`Emitiendo fileMessage a sala ${pin}`);
        io.to(pin).emit('fileMessage', {
          sender,
          messageType,
          fileData: message.fileData,
          timestamp: message.timestamp,
          securityCheck: message.securityCheck,
          tempId
        });
        
        // confirmar al emisor que se proceso correctamente
        socket.emit('fileSuccess', {
          tempId,
          success: true,
          securityCheck: {
            analyzed: true,
            isSafe: !securityValidation.checks.steganography?.isSuspicious
          }
        });
        
        // confirmar recepcion al cliente via callback
        if (callback) {
          callback({
            success: true,
            message: 'Archivo procesado correctamente',
            securityCheck: {
              analyzed: true,
              isSafe: !securityValidation.checks.steganography?.isSuspicious
            }
          });
        }
        
        console.log('Archivo procesado y enviado correctamente');

      } catch (error) {
        console.error(' Error al procesar archivo:', error);
        socket.emit('fileError', { message: 'Error al procesar el archivo', tempId, error: error.message });
        if (callback) callback({ success: false, message: 'Error al procesar el archivo' });
      }
    });

    // cargar mensajes (backup - los mensajes ya se cargan en joinRoom y reconnectToRoom)
    socket.on('requestPreviousMessages', async ({ pin }) => {
      try {
        const previousMessages = await Message.find({ pin }).sort({ timestamp: 1 });
        // DESCIFRAR mensajes de texto antes de enviar
        const decryptedMessages = previousMessages.map(msg => {
          const messageObj = msg.toObject();
          
          if (messageObj.messageType === 'text' && messageObj.encrypted && messageObj.text) {
            try {
              const decryptionResult = encryptionService.decryptMessage(messageObj.text, { 
                pin: messageObj.pin, 
                sender: messageObj.sender 
              });
              
              if (decryptionResult.success) {
                messageObj.text = decryptionResult.plaintext;
              } else {
                messageObj.text = '[Mensaje cifrado - error al descifrar]';
              }
            } catch (err) {
              messageObj.text = '[Mensaje cifrado - error al descifrar]';
            }
          }
          
          return messageObj;
        });
        
        socket.emit('previousMessages', decryptedMessages);
      } catch (error) {
        console.error('Error cargando mensajes previos:', error);
      }
    });

    // Actualizar actividad del usuario (heartbeat)
    socket.on('userActivity', ({ pin, deviceId }) => {
      // Verificar que el usuario está realmente en la sala
      const room = rooms[pin];
      if (room && room.users.some(u => u.id === socket.id)) {
        if (inactivityService && socket.id && pin && deviceId) {
          const clientIp = socket.clientIp || getClientIp(socket);
          inactivityService.updateActivity(socket.id, pin, deviceId, clientIp);
        }
      }
    });

    // Solicitar lista de usuarios
    socket.on('requestUserList', ({ pin }) => {
      const room = rooms[pin];
      if (room) {
        emitUserList(pin, room, io);
        console.log(`Lista de usuarios enviada a ${socket.id} para sala ${pin}`);
      }
    });

    // funcion auxiliar para manejar salas vacias
    const handleEmptyRoom = async (pin) => {
      const room = rooms[pin];
      
      // VERIFICACIÓN CRÍTICA: Confirmar que NO hay usuarios activos en memoria
      if (room && room.users && room.users.length > 0) {
        return; 
      }
      
      // Eliminar solo las sesiones de usuarios
      await DeviceSession.deleteMany({ pin: pin });
      
      // ACTUALIZAR PARTICIPANTES EN MONGODB (a 0) pero mantener isActive=true
      try {
        const roomDocument = await RoomModel.findOne({ pin: pin });
        if (roomDocument && roomDocument.isActive) {
          roomDocument.participantCount = 0;
          roomDocument.lastActivity = new Date();
          await roomDocument.save();
          // Actualizar pertenencias a desconectado
          await RoomMembership.updateMany(
            { roomPin: pin, isConnected: true },
            { 
              isConnected: false, 
              lastSeenAt: new Date() 
            }
          );
        }
      } catch (dbError) {
        console.error('Error actualizando sala en MongoDB:', dbError);
      }
      // Eliminar sala de memoria (pero mantener en MongoDB)
      delete rooms[pin];
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

      // DECREMENTAR PARTICIPANTES EN MONGODB
      try {
        const roomDocument = await RoomModel.findOne({ pin: pin });
        if (roomDocument) {
          await roomDocument.decrementParticipants();
        }
      } catch (dbError) {
        console.error('Error decrementando participantes en MongoDB:', dbError);
      }

      try {
        //  VERIFICAR Y ELIMINAR SESIÓN POR IP COMPLETAMENTE
        console.log(`Buscando sesión para eliminar: IP=${clientIp}, PIN=${pin}`);
        
        const sessionBefore = await DeviceSession.findOne({ ipAddress: clientIp });
        console.log(`Sesión antes de eliminar:`, sessionBefore ? `Existe (sala: ${sessionBefore.pin})` : 'No existe');
        
        // 🔒 ELIMINAR TODAS las sesiones de esta IP (pueden ser múltiples por diferentes navegadores)
        const result = await DeviceSession.deleteMany({ ipAddress: clientIp });
        console.log(`Sesiones eliminadas para IP ${clientIp} - Documentos eliminados: ${result.deletedCount}`);
        
        // Verificar que se eliminaron todas
        const remainingSessions = await DeviceSession.find({ ipAddress: clientIp });
        
        if (remainingSessions.length > 0) {
          console.error(`ERROR: Todavía quedan ${remainingSessions.length} sesiones para IP ${clientIp}`);
          remainingSessions.forEach(s => console.log(`  - ${s.roomPin}: ${s.deviceId}`));
        } else {
          console.log(`TODAS las sesiones eliminadas correctamente para IP ${clientIp}`);
        }
        
        // DESCONECTAR DE LA SALA (pero mantener pertenencia por si vuelve)
        const membership = await RoomMembership.findOne({ ip: clientIp, roomPin: pin });
        if (membership) {
          await membership.disconnect();
          console.log(`${nickname} DESCONECTADO de sala ${pin} (pertenencia mantenida)`);
        }
        
      } catch (err) {
        console.error(`Error eliminando sesion:`, err);
      }

      if (room.isEmpty()) {
        await handleEmptyRoom(pin);
      } else {
        // EMITIR userLeft CON CONTEO ACTUALIZADO
        io.to(pin).emit('userLeft', { userId: socket.id, nickname, count: room.users.length, limit: room.limit });
        
        // EMITIR participantCountUpdate A TODA LA SALA
        io.to(pin).emit('participantCountUpdate', { 
          count: room.users.length, 
          limit: room.limit,
          isLastUser: room.users.length === 1
        });
        
        // Emitir lista actualizada de usuarios
        emitUserList(pin, room, io);
      }

      if (callback) callback({ success: true, message: 'Sesion eliminada correctamente' });
    });

    // desconexion
    socket.on('disconnect', async () => {
      const clientIp = socket.clientIp || getClientIp(socket);
      //  Marcar en el servicio de inactividad
      if (inactivityService) {
        inactivityService.markDisconnected(socket.id);
      }

      // si fue una salida intencional, no hacer nada mas (ya se manejo en leaveRoom)
      if (socket.intentionalLeave) {
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
            console.log(`🔄 Usuario ${nickname} en proceso de recarga, NO remover de la sala`);
            // Mantener la sesión activa durante la recarga
            continue;
          }

          // verificar sesion por ip
          try {
            const session = await getSessionByIp(clientIp, pin);
            
            if (session) {
              // esperar tiempo suficiente para confirmar que es desconexion real y no recarga
              setTimeout(async () => {
                // verificar nuevamente si el usuario se ha reconectado
                const stillExists = rooms[pin]?.users.some(u => u.id === socket.id);
                
                if (stillExists) {
                  // Cancelar desconexión si se reconectó
                  if (inactivityService) {
                    inactivityService.cancelDisconnection(socket.id);
                  }
                  return;
                }
                // VERIFICAR SI ES EL ÚLTIMO USUARIO ANTES DE REMOVER
                const willBeEmpty = room.users.length === 1;
                
                room.removeUser(socket.id);
                await removeSession(deviceId, clientIp, pin);
                
                // DECREMENTAR PARTICIPANTES EN MONGODB
                try {
                  const roomDocument = await RoomModel.findOne({ pin: pin });
                  if (roomDocument) {
                    await roomDocument.decrementParticipants();
                    console.log(`Participante removido. Quedan ${roomDocument.participantCount} en BD`);
                  }
                } catch (dbError) {
                  console.error('Error decrementando participantes:', dbError);
                }
                
                if (willBeEmpty) {
                  handleEmptyRoom(pin);
                } else {
                  // EMITIR userLeft CON CONTEO ACTUALIZADO
                  io.to(pin).emit('userLeft', {
                    userId: socket.id,
                    nickname,
                    count: room.users.length,
                    limit: room.limit
                  });
                  
                  // EMITIR participantCountUpdate A TODA LA SALA
                  io.to(pin).emit('participantCountUpdate', { 
                    count: room.users.length, 
                    limit: room.limit,
                    isLastUser: room.users.length === 1
                  });
                  
                  // Emitir lista actualizada de usuarios
                  emitUserList(pin, room, io);
                }
              }, 10000);
              
              continue;
            }
          } catch (err) {
            console.error('Error verificando sesion en desconexion:', err);
          }
          // VERIFICAR SI ES EL ÚLTIMO USUARIO ANTES DE REMOVER
          const willBeEmpty = room.users.length === 1;
          
          room.removeUser(socket.id);
          await removeSession(deviceId, clientIp, pin);
          
          // DECREMENTAR PARTICIPANTES EN MONGODB
          try {
            const roomDocument = await RoomModel.findOne({ pin: pin });
            if (roomDocument) {
              await roomDocument.decrementParticipants();
              console.log(` Participante removido. Quedan ${roomDocument.participantCount} en BD`);
            }
          } catch (dbError) {
            console.error(' Error decrementando participantes:', dbError);
          }
          
          if (willBeEmpty) {
            handleEmptyRoom(pin);
          } else {
            // EMITIR userLeft CON CONTEO ACTUALIZADO
            io.to(pin).emit('userLeft', {
              userId: socket.id,
              nickname,
              count: room.users.length,
              limit: room.limit
            });
            
            // EMITIR participantCountUpdate
            io.to(pin).emit('participantCountUpdate', { 
              count: room.users.length, 
              limit: room.limit,
              isLastUser: room.users.length === 1
            });
            
            emitUserList(pin, room, io);
          }

          if (room.isEmpty()) {
            handleEmptyRoom(pin);
          } else {
            // EMITIR userLeft CON CONTEO ACTUALIZADO
            io.to(pin).emit('userLeft', {
              userId: socket.id,
              nickname,
              count: room.users.length,
              limit: room.limit
            });
            
            // EMITIR participantCountUpdate A TODA LA SALA
            io.to(pin).emit('participantCountUpdate', { 
              count: room.users.length, 
              limit: room.limit,
              isLastUser: room.users.length === 1
            });
            
            // Emitir lista actualizada de usuarios
            emitUserList(pin, room, io);
          }
        }
      }
    });
  });

  // Exponer función para detener servicios desde fuera (ej. shutdown)
  return {
    stop: () => {
      try {
        if (inactivityService) {
          inactivityService.stop();
        }
      } catch (err) {
        console.error('Error deteniendo InactivityService:', err);
      }
    }
  };
}

module.exports = RoomController;
