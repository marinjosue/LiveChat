const express = require('express');
const router = express.Router();
const RoomMembership = require('../models/RoomMembership');
const RoomModel = require('../models/RoomModel');
const Message = require('../models/Message');
const DeviceSession = require('../models/DeviceSession');

/**
 * GET /api/my-rooms/:deviceId
 * Obtener las salas donde el usuario tiene pertenencia activa
 */
router.get('/:deviceId', async (req, res) => {
  try {
    const { deviceId } = req.params;

    if (!deviceId) {
      return res.status(400).json({
        success: false,
        message: 'Device ID es requerido'
      });
    }

    // Buscar salas donde el usuario tiene pertenencia
    const memberships = await RoomMembership.findUserRooms(deviceId);
    
    if (!memberships || memberships.length === 0) {
      return res.json({
        success: true,
        rooms: [],
        message: 'No tienes salas guardadas'
      });
    }

    // Obtener información completa de cada sala
    const roomDetails = await Promise.all(
      memberships.map(async (membership) => {
        const roomDoc = await RoomModel.findOne({ 
          pin: membership.roomPin, 
          isActive: true 
        });
        
        if (!roomDoc) return null; // Sala eliminada por admin
        
        // Contar mensajes no leídos (opcional para futuras versiones)
        const messageCount = await Message.countDocuments({ 
          pin: membership.roomPin 
        });
        
        return {
          pin: roomDoc.pin,
          name: roomDoc.name,
          roomType: roomDoc.roomType,
          maxParticipants: roomDoc.maxParticipants,
          participantCount: roomDoc.participantCount,
          isFull: roomDoc.isFull(),
          isConnected: membership.isConnected,
          joinedAt: membership.joinedAt,
          lastSeenAt: membership.lastSeenAt,
          messageCount,
          nickname: membership.nickname
        };
      })
    );

    // Filtrar salas null (eliminadas)
    const validRooms = roomDetails.filter(room => room !== null);

    res.json({
      success: true,
      rooms: validRooms,
      total: validRooms.length
    });

  } catch (error) {
    console.error('Error obteniendo mis salas:', error);
    res.status(500).json({
      success: false,
      message: 'Error al obtener tus salas'
    });
  }
});

/**
 * POST /api/my-rooms/reconnect
 * Reconectar a una sala donde el usuario ya tiene pertenencia
 */
router.post('/reconnect', async (req, res) => {
  try {
    const { pin, deviceId, nickname } = req.body;

    if (!pin || !deviceId || !nickname) {
      return res.status(400).json({
        success: false,
        message: 'PIN, deviceId y nickname son requeridos'
      });
    }

    // Verificar que el usuario tiene pertenencia a esta sala
    const membership = await RoomMembership.findOne({
      deviceId,
      roomPin: pin,
      isActive: true,
      removedBy: null
    });

    if (!membership) {
      return res.status(403).json({
        success: false,
        message: 'No tienes pertenencia a esta sala'
      });
    }

    // Verificar que la sala existe y está activa
    const roomDoc = await RoomModel.findOne({ 
      pin, 
      isActive: true 
    });

    if (!roomDoc) {
      return res.status(404).json({
        success: false,
        message: 'Sala no encontrada o inactiva'
      });
    }

    // Actualizar nickname si cambió
    if (membership.nickname !== nickname) {
      membership.nickname = nickname;
      await membership.save();
    }

    res.json({
      success: true,
      message: 'Puedes reconectarte a esta sala',
      room: {
        pin: roomDoc.pin,
        name: roomDoc.name,
        roomType: roomDoc.roomType,
        maxParticipants: roomDoc.maxParticipants,
        participantCount: roomDoc.participantCount,
        isFull: roomDoc.isFull()
      }
    });

  } catch (error) {
    console.error('Error verificando reconexión:', error);
    res.status(500).json({
      success: false,
      message: 'Error al verificar reconexión'
    });
  }
});

/**
 * DELETE /api/my-rooms/leave-permanently/:pin/:deviceId
 * Salir permanentemente de una sala (eliminar pertenencia)
 */
router.delete('/leave-permanently/:pin/:deviceId', async (req, res) => {
  try {
    const { pin, deviceId } = req.params;

    const membership = await RoomMembership.findOne({
      deviceId,
      roomPin: pin,
      isActive: true
    });

    if (!membership) {
      return res.status(404).json({
        success: false,
        message: 'No tienes pertenencia a esta sala'
      });
    }

    membership.isActive = false;
    membership.removedBy = 'user';
    membership.removedAt = new Date();
    membership.isConnected = false;
    await membership.save();

    // 🧹 Limpiar también DeviceSession asociada
    try {
      await DeviceSession.deleteOne({ deviceId, roomPin: pin });
      console.log(`🧹 DeviceSession limpiada para ${deviceId} en sala ${pin}`);
    } catch (sessionError) {
      console.error('Error limpiando DeviceSession:', sessionError);
    }

    res.json({
      success: true,
      message: 'Has salido permanentemente de la sala'
    });

  } catch (error) {
    console.error('Error saliendo permanentemente:', error);
    res.status(500).json({
      success: false,
      message: 'Error al salir de la sala'
    });
  }
});

module.exports = router;