const express = require('express');
const router = express.Router();
const RoomModel = require('../models/RoomModel');
// const { AuditService } = require('../services/auditService');
// const auditService = new AuditService();

/**
 * GET /api/rooms/public
 * Obtener todas las salas públicas disponibles
 */
router.get('/public', async (req, res) => {
  try {
    const ipAddress = req.ip || req.connection.remoteAddress;
    
    // Obtener solo salas activas y públicas
    const rooms = await RoomModel.find({ 
      isActive: true
    })
    .select('pin name encryptedId roomType multimediaConfig createdAt participantCount maxParticipants')
    .sort({ createdAt: -1 })
    .limit(50);

    // Preparar información de salas públicas
    const publicRooms = rooms.map(room => ({
      pin: room.pin,
      name: room.name,
      encryptedId: room.encryptedId,
      roomType: room.roomType,
      isMultimedia: room.roomType === 'multimedia',
      participantCount: room.participantCount || 0,
      maxParticipants: room.maxParticipants || 10,
      createdAt: room.createdAt,
      isFull: room.isFull()
    }));

    // Log de acceso (comentado temporalmente)
    // await auditService.log(
    //   null, // No requiere admin
    //   'ROOMS_LIST_ACCESSED',
    //   { 
    //     ipAddress,
    //     roomsCount: publicRooms.length 
    //   },
    //   ipAddress,
    //   req.get('User-Agent'),
    //   'success'
    // );

    res.json({
      success: true,
      rooms: publicRooms,
      total: publicRooms.length
    });

  } catch (error) {
    console.error('Error obteniendo salas públicas:', error);
    res.status(500).json({
      success: false,
      message: 'Error al obtener las salas disponibles'
    });
  }
});

/**
 * GET /api/rooms/:pin/info
 * Obtener información de una sala específica
 */
router.get('/:pin/info', async (req, res) => {
  try {
    const { pin } = req.params;
    const ipAddress = req.ip || req.connection.remoteAddress;

    const room = await RoomModel.findOne({ 
      pin: pin,
      isActive: true 
    }).select('name roomType multimediaConfig participantCount maxParticipants createdAt');

    if (!room) {
      return res.status(404).json({
        success: false,
        message: 'Sala no encontrada'
      });
    }

    res.json({
      success: true,
      room: {
        pin,
        name: room.name,
        roomType: room.roomType,
        isMultimedia: room.roomType === 'multimedia',
        participantCount: room.participantCount || 0,
        maxParticipants: room.maxParticipants || 10,
        isFull: room.isFull(),
        multimediaConfig: room.roomType === 'multimedia' ? room.multimediaConfig : null
      }
    });

  } catch (error) {
    console.error('Error obteniendo información de sala:', error);
    res.status(500).json({
      success: false,
      message: 'Error al obtener información de la sala'
    });
  }
});

module.exports = router;
