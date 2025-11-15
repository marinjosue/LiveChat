const express = require('express');
const router = express.Router();
const RoomModel = require('../models/RoomModel');
const { authMiddleware } = require('../middleware/authMiddleware');
const generatePIN = require('../utils/pinGenerator');
const {
  validateRoomConfig,
  getMultimediaConfig,
  ROOM_LIMITS
} = require('../config/roomConfig');

/**
 * Middleware de autenticación para todas las rutas
 */
router.use(authMiddleware);

/**
 * POST /api/admin/rooms
 * Crear una nueva sala (solo admin)
 */
router.post('/', async (req, res) => {
  try {
    const { name, roomType, maxParticipants } = req.body;
    const adminId = req.admin.adminId;

    console.log('📥 Solicitud de creación de sala recibida:');
    console.log('   - Nombre:', name);
    console.log('   - Tipo recibido:', roomType);
    console.log('   - Tipo de dato:', typeof roomType);
    console.log('   - Max participantes:', maxParticipants);

    // Validar configuración usando el módulo centralizado
    const validation = validateRoomConfig({ name, roomType, maxParticipants });
    
    if (!validation.isValid) {
      return res.status(400).json({
        success: false,
        message: validation.errors[0],
        errors: validation.errors
      });
    }

    // Verificar límite de salas activas
    const activeRoomsCount = await RoomModel.countDocuments({ isActive: true });

    if (activeRoomsCount >= ROOM_LIMITS.MAX_ACTIVE_ROOMS) {
      return res.status(400).json({
        success: false,
        message: `Se ha alcanzado el límite máximo de salas activas (${ROOM_LIMITS.MAX_ACTIVE_ROOMS})`
      });
    }

    // Generar PIN único
    const existingPins = await RoomModel.find({ isActive: true }).select('pin');
    const existingPinsList = existingPins.map(r => r.pin);
    const pin = generatePIN(existingPinsList);

    // Obtener configuración multimedia según el tipo
    const multimediaConfig = getMultimediaConfig(roomType);

    // Generar hashedPin y encryptedId
    const crypto = require('crypto');
    const hashedPin = crypto.createHash('sha256').update(pin.toString()).digest('hex');
    const data = `${Date.now()}-${Math.random()}-${process.pid}`;
    const encryptedId = crypto.createHash('sha256').update(data).digest('hex').substring(0, 16);

    // Crear sala en MongoDB con configuración parametrizada
    const newRoom = new RoomModel({
      pin,
      hashedPin,
      encryptedId,
      name: name.trim(),
      roomType,
      maxParticipants,
      participantCount: 0,
      createdBy: adminId,
      isActive: true,
      multimediaConfig
    });
    
    await newRoom.save();

    console.log(`✅ Sala creada por admin: ${req.admin.username}`);
    console.log(`   PIN: ${pin}, Nombre: ${name}, Tipo: ${roomType}`);
    console.log(`   Config multimedia:`, multimediaConfig);

    // Notificar a todos los clientes conectados sobre la nueva sala
    const io = req.app.get('io');
    if (io) {
      io.emit('roomCreated', {
        pin: newRoom.pin,
        name: newRoom.name,
        roomType: newRoom.roomType,
        maxParticipants: newRoom.maxParticipants,
        participantCount: newRoom.participantCount,
        isActive: newRoom.isActive,
        createdAt: newRoom.createdAt,
        isFull: false
      });
    }

    res.json({
      success: true,
      message: 'Sala creada exitosamente',
      room: {
        pin: newRoom.pin,
        name: newRoom.name,
        encryptedId: newRoom.encryptedId,
        roomType: newRoom.roomType,
        maxParticipants: newRoom.maxParticipants,
        participantCount: newRoom.participantCount,
        isActive: newRoom.isActive,
        createdAt: newRoom.createdAt,
        multimediaConfig: {
          allowFiles: roomType === 'multimedia',
          maxFileSize: multimediaConfig.maxFileSize,
          allowedTypesCount: multimediaConfig.allowedFileTypes.length
        }
      }
    });

  } catch (error) {
    console.error('❌ Error creando sala:', error);
    res.status(500).json({
      success: false,
      message: 'Error al crear la sala',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

/**
 * GET /api/admin/rooms
 * Obtener todas las salas creadas (activas e inactivas)
 */
router.get('/', async (req, res) => {
  try {
    console.log('📥 GET /api/admin/rooms - Solicitado por:', req.admin.username);
    
    const rooms = await RoomModel.find()
      .select('pin name encryptedId roomType maxParticipants participantCount isActive createdAt lastActivity')
      .sort({ createdAt: -1 })
      .limit(100);

    console.log(`✅ Encontradas ${rooms.length} salas en la base de datos`);

    const roomsData = rooms.map(room => ({
      pin: room.pin,
      name: room.name,
      encryptedId: room.encryptedId,
      roomType: room.roomType,
      maxParticipants: room.maxParticipants,
      participantCount: room.participantCount,
      isActive: room.isActive,
      createdAt: room.createdAt,
      lastActivity: room.lastActivity,
      isFull: room.isFull()
    }));

    console.log('📤 Enviando salas:', roomsData);

    res.json({
      success: true,
      rooms: roomsData,
      total: rooms.length
    });

  } catch (error) {
    console.error('❌ Error obteniendo salas:', error);
    res.status(500).json({
      success: false,
      message: 'Error al obtener las salas',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

/**
 * GET /api/admin/rooms/:pin
 * Obtener información detallada de una sala específica
 */
router.get('/:pin', async (req, res) => {
  try {
    const { pin } = req.params;

    const room = await RoomModel.findOne({ pin })
      .populate('createdBy', 'username role');

    if (!room) {
      return res.status(404).json({
        success: false,
        message: 'Sala no encontrada'
      });
    }

    res.json({
      success: true,
      room: {
        pin: room.pin,
        name: room.name,
        hashedPin: room.hashedPin,
        encryptedId: room.encryptedId,
        roomType: room.roomType,
        maxParticipants: room.maxParticipants,
        participantCount: room.participantCount,
        isActive: room.isActive,
        createdAt: room.createdAt,
        lastActivity: room.lastActivity,
        createdBy: room.createdBy,
        multimediaConfig: room.multimediaConfig,
        isFull: room.isFull()
      }
    });

  } catch (error) {
    console.error('Error obteniendo sala:', error);
    res.status(500).json({
      success: false,
      message: 'Error al obtener información de la sala'
    });
  }
});

/**
 * DELETE /api/admin/rooms/:pin
 * Eliminar una sala (marcar como inactiva)
 */
router.delete('/:pin', async (req, res) => {
  try {
    const { pin } = req.params;
    const adminUsername = req.admin.username;

    const room = await RoomModel.findOne({ pin });

    if (!room) {
      return res.status(404).json({
        success: false,
        message: 'Sala no encontrada'
      });
    }

    // Marcar como inactiva en lugar de eliminar
    await room.deactivate();

    console.log(`✅ Sala ${pin} eliminada por admin: ${adminUsername}`);

    // Notificar a todos los clientes sobre la sala eliminada
    const io = req.app.get('io');
    if (io) {
      io.emit('roomDeleted', { pin });
      // También notificar a los usuarios en esa sala
      io.to(pin).emit('roomClosedByAdmin', { 
        message: 'Esta sala ha sido cerrada por un administrador' 
      });
    }

    res.json({
      success: true,
      message: 'Sala eliminada exitosamente'
    });

  } catch (error) {
    console.error('Error eliminando sala:', error);
    res.status(500).json({
      success: false,
      message: 'Error al eliminar la sala'
    });
  }
});

/**
 * PATCH /api/admin/rooms/:pin/activate
 * Reactivar una sala inactiva
 */
router.patch('/:pin/activate', async (req, res) => {
  try {
    const { pin } = req.params;

    const room = await RoomModel.findOne({ pin });

    if (!room) {
      return res.status(404).json({
        success: false,
        message: 'Sala no encontrada'
      });
    }

    room.isActive = true;
    room.lastActivity = new Date();
    await room.save();

    console.log(`✅ Sala ${pin} reactivada por admin: ${req.admin.username}`);

    res.json({
      success: true,
      message: 'Sala reactivada exitosamente'
    });

  } catch (error) {
    console.error('Error reactivando sala:', error);
    res.status(500).json({
      success: false,
      message: 'Error al reactivar la sala'
    });
  }
});

/**
 * DELETE /api/admin/rooms/:pin/messages
 * Eliminar todos los mensajes de una sala específica (limpieza)
 * Solo el administrador puede hacer esto
 */
router.delete('/:pin/messages', async (req, res) => {
  try {
    const { pin } = req.params;
    const Message = require('../models/Message');

    const room = await RoomModel.findOne({ pin });

    if (!room) {
      return res.status(404).json({
        success: false,
        message: 'Sala no encontrada'
      });
    }

    // Contar mensajes antes de eliminar
    const messageCount = await Message.countDocuments({ pin });

    // Eliminar todos los mensajes de la sala
    const result = await Message.deleteMany({ pin });

    console.log(`✅ Admin ${req.admin.username} eliminó ${result.deletedCount} mensajes de sala ${pin}`);

    res.json({
      success: true,
      message: `${result.deletedCount} mensajes eliminados exitosamente`,
      deletedCount: result.deletedCount,
      previousCount: messageCount
    });

  } catch (error) {
    console.error('Error eliminando mensajes:', error);
    res.status(500).json({
      success: false,
      message: 'Error al eliminar los mensajes'
    });
  }
});

module.exports = router;
