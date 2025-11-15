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

const rooms = {};

// variable global para temporizadores de eliminacion de salas
const deletionTimers = {};

// variable para rastrear usuarios en proceso de recarga
const refreshingUsers = new Set();

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

// funcion para detectar info del navegador basado en el deviceId y user-agent
const getBrowserInfo = (deviceId) => {
  // El deviceId es único por navegador/sesión, pero podemos inferir algunos patrones
  const timestamp = new Date().toLocaleTimeString();
  return `otro navegador/ventana (ID: ${deviceId.slice(-8)})`;
};

function RoomController(io) {
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
            console.log(`✅ Sala ${pin} cargada desde MongoDB a memoria`);
          }
        } catch (dbError) {
          console.error('Error buscando sala en MongoDB:', dbError);
        }
      }
      
      if (!room) return callback({ success: false, message: 'PIN invalido.' });
      if (room.isFull()) return callback({ success: false, message: 'La sala esta llena.' });

      try {
        const clientIp = getClientIp(socket);
        
        console.log(`🔍 Cliente intentando unirse: IP=${clientIp}, PIN=${pin}, deviceId=${deviceId}`);
        
        // 🔒 VALIDACIÓN CRÍTICA POR IP: Una IP = Una sala (sin importar navegador/incógnito)
        // Buscar si esta IP ya está en CUALQUIER sala activa
        const existingSessions = await DeviceSession.find({ ip: clientIp });
        console.log(`📋 Sesiones encontradas para IP ${clientIp}:`, existingSessions.length);
        
        for (const session of existingSessions) {
          console.log(`  - Sesión: PIN=${session.roomPin}, deviceId=${session.deviceId}, nickname=${session.nickname}`);
        }
        
        const ipInAnyRoom = existingSessions[0]; // Tomar la primera sesión encontrada
        
        if (ipInAnyRoom) {
          console.log(`🔍 IP ${clientIp} encontrada en sala: ${ipInAnyRoom.roomPin}, intentando acceder a: ${pin}`);
          
          // 🔒 BLOQUEAR CUALQUIER ACCESO DESDE OTRO NAVEGADOR
          // Comparar deviceId para detectar si es el mismo navegador o uno diferente
          if (ipInAnyRoom.deviceId !== deviceId) {
            // Es un navegador/sesión diferente - BLOQUEAR COMPLETAMENTE
            console.log(`❌ BLOQUEADO: IP ${clientIp} ya tiene sesión activa desde otro navegador (deviceId: ${ipInAnyRoom.deviceId})`);
            
            // Detectar tipo de navegador basado en deviceId anterior
            const browserInfo = getBrowserInfo(ipInAnyRoom.deviceId);
            
            return callback({ 
              success: false, 
              message: `⚠️ ACCESO BLOQUEADO\n\nEste dispositivo ya tiene una sesión activa en la sala ${ipInAnyRoom.roomPin} desde ${browserInfo}.\n\n🔹 Usuario: ${ipInAnyRoom.nickname}\n🔹 Activo desde: ${new Date(ipInAnyRoom.lastActive).toLocaleString()}\n\n📋 Para acceder:\n1. Cierre TODAS las ventanas del navegador actual\n2. Vaya al otro navegador y haga clic en "Salir"\n3. O borre el caché/cookies del navegador actual\n\n⚡ Solo puede estar en UNA sala por dispositivo.` 
            });
          }
          
          // Es el mismo navegador - permitir reconexión
          if (ipInAnyRoom.roomPin === pin) {
            console.log(`✅ IP ${clientIp} reconectando desde el mismo navegador a sala ${pin}`);
            ipInAnyRoom.nickname = nickname;
            ipInAnyRoom.lastActive = Date.now();
            await ipInAnyRoom.save();
          } else {
            // Mismo navegador pero diferente sala - bloquear
            console.log(`❌ BLOQUEADO: Mismo navegador intenta cambiar de sala ${ipInAnyRoom.roomPin} a ${pin}`);
            return callback({ 
              success: false, 
              message: `Ya estás en la sala ${ipInAnyRoom.roomPin}. Debes salir de esa sala antes de unirte a otra.` 
            });
          }
        } else {
          console.log(`✅ IP ${clientIp} no tiene sesiones activas, permitiendo acceso a sala ${pin}`);
        }

        await registerSession(deviceId, clientIp, pin, nickname);
        room.addUser(socket.id, nickname, deviceId);
        socket.join(pin);
        socket.clientIp = clientIp;
        socket.userPin = pin;
        socket.userNickname = nickname;

        // ✅ CREAR O ACTUALIZAR ROOM MEMBERSHIP
        try {
          await RoomMembership.createOrUpdate(deviceId, nickname, pin, clientIp);
          console.log(`✅ RoomMembership creado/actualizado para ${nickname} en sala ${pin}`);
        } catch (membershipError) {
          console.error('⚠️ Error creando RoomMembership:', membershipError);
        }

        // ✅ ACTUALIZAR CONTADOR EN MONGODB
        try {
          const roomDocument = await RoomModel.findOne({ pin: pin });
          if (roomDocument) {
            await roomDocument.incrementParticipants();
            console.log(`✅ Participantes en BD actualizados: ${roomDocument.participantCount}`);
          }
        } catch (dbError) {
          console.error('⚠️ Error actualizando participantes en MongoDB:', dbError);
        }

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
        console.log(`🔍 Tipo de sala: ${room.roomType}`);
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

      // eliminar de la lista despues de un tiempo prudencial
      setTimeout(() => {
        refreshingUsers.delete(key);
      }, 30000);
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
              console.log(`✅ Sala ${pin} cargada desde MongoDB a memoria (reconnect)`);
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

        // 🔒 BUSCAR SESIÓN POR IP (no por deviceId, ya que puede cambiar entre navegadores)
        const session = await getSessionByIp(clientIp, pin);
        if (!session) {
          console.log(`❌ No hay sesión válida para IP ${clientIp} en sala ${pin}`);
          return callback({ success: false, message: 'Sesion no valida o expirada para este dispositivo' });
        }

        console.log(`✅ Sesión encontrada para IP ${clientIp}: ${session.nickname} en sala ${pin}`);

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
          socket.emit('previousMessages', previousMessages);
          
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
        
        // ✅ RECONECTAR ROOM MEMBERSHIP
        try {
          // Buscar por IP ya que el deviceId puede haber cambiado
          const membership = await RoomMembership.findOne({ ip: clientIp, roomPin: pin });
          if (membership) {
            membership.deviceId = deviceId; // Actualizar deviceId
            await membership.reconnect();
            console.log(`✅ RoomMembership reconectado para ${session.nickname} en sala ${pin}`);
          } else {
            // Si no existe, crearlo
            await RoomMembership.createOrUpdate(deviceId, session.nickname, pin, clientIp);
            console.log(`✅ RoomMembership creado para ${session.nickname} en sala ${pin}`);
          }
        } catch (membershipError) {
          console.error('⚠️ Error reconectando RoomMembership:', membershipError);
        }
        
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
        
        console.log(`📤 [SOCKET] Recibiendo archivo: ${fileName} (${fileType}, ${fileSize} bytes) en sala ${pin}`);
        
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
          console.log(`🚫 Sala no encontrada en BD para PIN: ${pin}`);
          socket.emit('fileError', { message: 'Sala no encontrada en base de datos', tempId });
          if (callback) callback({ success: false, message: 'Sala no encontrada en base de datos' });
          return;
        }

        if (roomDocument.roomType === 'text') {
          console.log(`🚫 Intento de subir archivo a sala de solo texto (PIN: ${pin})`);
          socket.emit('fileError', { message: 'Esta sala es solo para mensajes de texto. No se permiten archivos multimedia.', tempId });
          if (callback) callback({ success: false, message: 'Esta sala es solo para mensajes de texto' });
          return;
        }

        // usar socket.userNickname directamente
        const sender = socket.userNickname || 'Anonimo';
        console.log(`Enviado por: ${sender}`);

        // ===== 2. VALIDAR TAMAÑO =====
        const MAX_SIZE = 15 * 1024 * 1024;
        if (fileSize > MAX_SIZE) {
          console.log('Archivo demasiado grande');
          socket.emit('fileError', { message: 'El archivo supera el limite de 15MB', tempId });
          if (callback) callback({ success: false, message: 'El archivo supera el limite de 15MB' });
          return;
        }

        // ===== 3. CONVERTIR BASE64 A BUFFER PARA ANÁLISIS =====
        let fileBuffer;
        try {
          const base64String = fileData.split(',')[1];
          fileBuffer = Buffer.from(base64String, 'base64');
          console.log(`✓ Buffer creado: ${fileBuffer.length} bytes`);
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
            maxSize: 15 * 1024 * 1024
          }
        );

        // ===== 5. EVALUAR RESULTADO DEL ANÁLISIS =====
        if (!securityValidation.isValid) {
          console.error(`[SECURITY] Archivo rechazado: ${securityValidation.errors.join(', ')}`);
          
          // Registrar rechazo en auditoría
          await AuditService.logFileRejected(
            null,
            {
              fileName,
              fileSize,
              fileType,
              method: 'socket.io'
            },
            securityValidation.errors.join(', '),
            socket.handshake.address
          );

          socket.emit('fileError', {
            message: 'Archivo rechazado por razones de seguridad',
            errors: securityValidation.errors,
            warnings: securityValidation.warnings,
            tempId
          });
          
          if (callback) {
            callback({
              success: false,
              message: 'Archivo rechazado por razones de seguridad',
              errors: securityValidation.errors
            });
          }
          
          return;
        }

        // ===== 6. REGISTRAR ADVERTENCIAS (Si hay esteganografía sospechosa) =====
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
        
        console.log('✅ Subido a Cloudinary:', uploadResult.url);

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
        console.log('✓ Mensaje guardado en BD con info de seguridad');

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
        
        console.log('✅ Archivo procesado y enviado correctamente');

      } catch (error) {
        console.error('❌ Error al procesar archivo:', error);
        socket.emit('fileError', { message: 'Error al procesar el archivo', tempId, error: error.message });
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
      console.log(`📭 Sala ${pin} quedó vacía. Manteniendo mensajes persistentes.`);
      
      // Eliminar solo las sesiones de usuarios
      await DeviceSession.deleteMany({ roomPin: pin });
      
      // ✅ ACTUALIZAR PARTICIPANTES EN MONGODB (a 0) pero mantener isActive=true
      try {
        const roomDocument = await RoomModel.findOne({ pin: pin });
        if (roomDocument && roomDocument.isActive) {
          roomDocument.participantCount = 0;
          roomDocument.lastActivity = new Date();
          await roomDocument.save();
          console.log(`✅ Sala ${pin} actualizada: 0 participantes activos, mensajes conservados.`);
          
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
        console.error('⚠️ Error actualizando sala en MongoDB:', dbError);
      }
      
      // Eliminar sala de memoria (pero mantener en MongoDB)
      delete rooms[pin];
      console.log(`🗂️ Sala ${pin} archivada en memoria. Disponible en BD para reconexión.`);
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

      // ✅ DECREMENTAR PARTICIPANTES EN MONGODB
      try {
        const roomDocument = await RoomModel.findOne({ pin: pin });
        if (roomDocument) {
          await roomDocument.decrementParticipants();
          console.log(`✅ Participante removido. Quedan ${roomDocument.participantCount} en BD`);
        }
      } catch (dbError) {
        console.error('⚠️ Error decrementando participantes en MongoDB:', dbError);
      }

      try {
        // 🔒 VERIFICAR Y ELIMINAR SESIÓN POR IP COMPLETAMENTE
        console.log(`🔍 Buscando sesión para eliminar: IP=${clientIp}, PIN=${pin}`);
        
        const sessionBefore = await DeviceSession.findOne({ ip: clientIp });
        console.log(`📋 Sesión antes de eliminar:`, sessionBefore ? `Existe (sala: ${sessionBefore.roomPin})` : 'No existe');
        
        // 🔒 ELIMINAR TODAS las sesiones de esta IP (pueden ser múltiples por diferentes navegadores)
        const result = await DeviceSession.deleteMany({ ip: clientIp });
        console.log(`🗑️ Sesiones eliminadas para IP ${clientIp} - Documentos eliminados: ${result.deletedCount}`);
        
        // Verificar que se eliminaron todas
        const remainingSessions = await DeviceSession.find({ ip: clientIp });
        console.log(`📋 Sesiones restantes después de eliminar:`, remainingSessions.length);
        
        if (remainingSessions.length > 0) {
          console.error(`⚠️ ERROR: Todavía quedan ${remainingSessions.length} sesiones para IP ${clientIp}`);
          remainingSessions.forEach(s => console.log(`  - ${s.roomPin}: ${s.deviceId}`));
        } else {
          console.log(`✅ TODAS las sesiones eliminadas correctamente para IP ${clientIp}`);
        }
        
        // ✅ DESCONECTAR DE LA SALA (pero mantener pertenencia por si vuelve)
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
