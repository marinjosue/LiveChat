/**
 * Servicio de gestión de inactividad
 * Detecta usuarios inactivos y limpia sesiones automáticamente
 */

const DeviceSession = require('../models/DeviceSession');
const RoomMembership = require('../models/RoomMembership');
const { LoggerService } = require('./loggerService');
const mongoose = require('mongoose');

// Configuración de timeouts
const INACTIVITY_CONFIG = {
  // Tiempo máximo de inactividad antes de desconectar (30 segundos para pruebas)
  MAX_INACTIVITY_TIME: 30 * 1000,
  // Advertencia de inactividad antes de desconectar (10 segundos)
  INACTIVITY_WARNING_TIME: 10 * 1000,
  // Intervalo de verificación de inactividad (cada 5 segundos para pruebas)
  CHECK_INTERVAL: 5 * 1000,
  // Tiempo de gracia para reconexión después de cerrar navegador (30 segundos)
  RECONNECTION_GRACE_PERIOD: 30 * 1000,
  // Tiempo para limpiar sesiones huérfanas (5 minutos)
  ORPHAN_SESSION_CLEANUP: 1 * 60 * 1000
};

class InactivityService {
  constructor(io) {
    this.io = io;
    this.checkInterval = null;
    this.orphanCleanupInterval = null;
    this.userActivityMap = new Map(); // Map<socketId, {lastActivity, pin, deviceId, ip}>
    this.disconnectionTimers = new Map(); // Map<socketId, timeoutId>
    this.warningTimers = new Map(); // Map<socketId, warningTimerId>
    this.warningSent = new Map(); // Map<socketId, boolean>
    this.alreadyDisconnecting = new Map(); // Map<socketId, boolean> - evitar duplicados
    
    LoggerService.info('InactivityService initialized', {
      maxInactivity: `${INACTIVITY_CONFIG.MAX_INACTIVITY_TIME / 1000}s`,
      warningTime: `${INACTIVITY_CONFIG.INACTIVITY_WARNING_TIME / 1000}s`,
      checkInterval: `${INACTIVITY_CONFIG.CHECK_INTERVAL / 1000}s`
    });
  }

  /**
   * Inicia el servicio de monitoreo de inactividad
   */
  start() {
    if (this.checkInterval) {
      console.log('InactivityService ya está en ejecución');
      return;
    }

    console.log('InactivityService iniciado');
    
    // Verificar inactividad periódicamente
    this.checkInterval = setInterval(() => {
      this.checkInactiveUsers();
    }, INACTIVITY_CONFIG.CHECK_INTERVAL);

    // Limpiar sesiones huérfanas cada cierto tiempo
    this.orphanCleanupInterval = setInterval(() => {
      this.cleanOrphanSessions();
    }, INACTIVITY_CONFIG.ORPHAN_SESSION_CLEANUP);

    LoggerService.info('InactivityService started');
  }

  /**
   * Detiene el servicio de monitoreo
   */
  stop() {
    if (this.checkInterval) {
      clearInterval(this.checkInterval);
      this.checkInterval = null;
      console.log('InactivityService detenido');
      LoggerService.info('InactivityService stopped');
    }

    // Limpiar todos los timers pendientes
    for (const [socketId, timerId] of this.disconnectionTimers) {
      clearTimeout(timerId);
    }
    this.disconnectionTimers.clear();
    
    // Limpiar timers de advertencia
    for (const [socketId, timerId] of this.warningTimers) {
      clearTimeout(timerId);
    }
    this.warningTimers.clear();
    this.warningSent.clear();
    if (this.orphanCleanupInterval) {
      clearInterval(this.orphanCleanupInterval);
      this.orphanCleanupInterval = null;
    }
  }

  /**
   * Registra actividad de un usuario
   * @param {string} socketId - ID del socket del usuario
   * @param {string} pin - PIN de la sala
   * @param {string} deviceId - ID del dispositivo
   */
  updateActivity(socketId, pin, deviceId, ip = null) {
    const now = Date.now();
    
    // Obtener IP del socket si no se proporciona
    if (!ip && this.io.sockets.sockets.has(socketId)) {
      const socket = this.io.sockets.sockets.get(socketId);
      ip = socket.clientIp || socket.handshake.address;
    }
    
    this.userActivityMap.set(socketId, {
      lastActivity: now,
      pin,
      deviceId,
      ip
    });

    // Cancelar timer de advertencia si existe
    if (this.warningTimers.has(socketId)) {
      clearTimeout(this.warningTimers.get(socketId));
      this.warningTimers.delete(socketId);
      this.warningSent.delete(socketId);
    }

    // Cancelar timer de desconexión si existe
    if (this.disconnectionTimers.has(socketId)) {
      clearTimeout(this.disconnectionTimers.get(socketId));
      this.disconnectionTimers.delete(socketId);
    }

    // Actualizar lastActive en la base de datos
    this.updateSessionActivity(deviceId, pin).catch(err => {
      console.error('Error actualizando actividad en BD:', err);
    });
  }

  /**
   * Actualiza la actividad de la sesión en la base de datos
   * @param {string} deviceId - ID del dispositivo
   * @param {string} pin - PIN de la sala
   */
  async updateSessionActivity(deviceId, pin) {
    try {
      const session = await DeviceSession.findOne({ deviceId, roomPin: pin });
      if (session) {
        session.lastActive = new Date();
        await session.save();
      }

      const membership = await RoomMembership.findOne({ deviceId, roomPin: pin });
      if (membership) {
        membership.lastSeenAt = new Date();
        await membership.save();
      }
    } catch (error) {
      LoggerService.error('Error updating session activity', {
        error: error.message,
        deviceId,
        pin
      });
    }
  }

  /**
   * Marca un usuario como desconectado
   * @param {string} socketId - ID del socket
   */
  markDisconnected(socketId) {
    const userData = this.userActivityMap.get(socketId);
    if (!userData) return;

    const { pin, deviceId, ip } = userData;
    
    console.log(`⏱️ Usuario ${socketId} desconectado, iniciando período de gracia...`);

    // Crear timer de desconexión con período de gracia
    const timerId = setTimeout(async () => {
      console.log(`Período de gracia terminado para ${socketId}, limpiando sesión...`);
      await this.cleanupUserSession(socketId, pin, deviceId, ip);
      this.disconnectionTimers.delete(socketId);
      this.userActivityMap.delete(socketId);
    }, INACTIVITY_CONFIG.RECONNECTION_GRACE_PERIOD);

    this.disconnectionTimers.set(socketId, timerId);

    LoggerService.info('User marked as disconnected', {
      socketId,
      pin,
      gracePeriod: `${INACTIVITY_CONFIG.RECONNECTION_GRACE_PERIOD / 1000}s`
    });
  }

  /**
   * Cancela el período de gracia (usuario se reconectó)
   * @param {string} socketId - ID del socket
   */
  cancelDisconnection(socketId) {
    if (this.disconnectionTimers.has(socketId)) {
      clearTimeout(this.disconnectionTimers.get(socketId));
      this.disconnectionTimers.delete(socketId);
      console.log(`✅ Reconexión confirmada para ${socketId}, timer cancelado`);
      
      LoggerService.info('User reconnection confirmed', { socketId });
    }
  }

  /**
   * Verifica usuarios inactivos y los desconecta
   */
  async checkInactiveUsers() {
    const now = Date.now();
    const warningThreshold = INACTIVITY_CONFIG.MAX_INACTIVITY_TIME - INACTIVITY_CONFIG.INACTIVITY_WARNING_TIME;
    const usersToWarn = [];
    const usersToDisconnect = [];

    for (const [socketId, userData] of this.userActivityMap) {
      const timeSinceLastActivity = now - userData.lastActivity;
      
      // Skip si ya está en proceso de desconexión
      if (this.alreadyDisconnecting.has(socketId)) {
        continue;
      }
      
      // Si alcanzó el tiempo máximo, desconectar
      if (timeSinceLastActivity >= INACTIVITY_CONFIG.MAX_INACTIVITY_TIME) {
        usersToDisconnect.push({ socketId, ...userData });
      }
      // Si está cerca del límite y no se ha enviado advertencia, advertir
      else if (timeSinceLastActivity >= warningThreshold && !this.warningSent.has(socketId)) {
        usersToWarn.push({ socketId, ...userData });
      }
    }

    // Enviar advertencias
    if (usersToWarn.length > 0) {
      console.log(`Enviando advertencia a ${usersToWarn.length} usuarios por inactividad`);
      
      for (const user of usersToWarn) {
        this.sendInactivityWarning(user.socketId, user.pin);
      }
    }

    // Desconectar usuarios inactivos
    if (usersToDisconnect.length > 0) {
      console.log(`Desconectando ${usersToDisconnect.length} usuarios inactivos`);
      
      for (const user of usersToDisconnect) {
        await this.disconnectInactiveUser(user.socketId, user.pin, user.deviceId);
      }
    }
  }

  /**
   * Envía advertencia de inactividad al usuario
   * @param {string} socketId - ID del socket
   * @param {string} pin - PIN de la sala
   */
  sendInactivityWarning(socketId, pin) {
    try {
      const socket = this.io.sockets.sockets.get(socketId);
      
      if (socket) {
        // Marcar advertencia como enviada
        this.warningSent.set(socketId, true);
        
        // Enviar advertencia con cuenta regresiva
        socket.emit('inactivityWarning', {
          message: 'Estás inactivo. ¿Sigues ahí?',
          secondsRemaining: INACTIVITY_CONFIG.INACTIVITY_WARNING_TIME / 1000,
          reason: 'INACTIVITY_WARNING'
        });

        console.log(`Advertencia enviada a usuario ${socketId} en sala ${pin}`);
        
        LoggerService.info('Inactivity warning sent', {
          socketId,
          pin,
          secondsToDisconnect: INACTIVITY_CONFIG.INACTIVITY_WARNING_TIME / 1000
        });
      }
    } catch (error) {
      console.error(`Error enviando advertencia a ${socketId}:`, error);
      LoggerService.error('Error sending inactivity warning', {
        error: error.message,
        socketId,
        pin
      });
    }
  }

  /**
   * Desconecta un usuario inactivo
   * @param {string} socketId - ID del socket
   * @param {string} pin - PIN de la sala
   * @param {string} deviceId - ID del dispositivo
   */
  async disconnectInactiveUser(socketId, pin, deviceId) {
    try {
      // Marcar como en proceso de desconexión para evitar duplicados
      if (this.alreadyDisconnecting.has(socketId)) {
        return;
      }
      
      this.alreadyDisconnecting.set(socketId, true);
      
      const socket = this.io.sockets.sockets.get(socketId);
      const userData = this.userActivityMap.get(socketId);
      const ip = userData?.ip;
      
      if (socket) {
        // Notificar al usuario antes de desconectar
        socket.emit('inactivityWarning', {
          message: 'Has sido desconectado por inactividad prolongada',
          reason: 'INACTIVITY_TIMEOUT'
        });

        console.log(`⏱️ Desconectando usuario inactivo: ${socketId} de sala ${pin}`);
        
        // Desconectar el socket
        socket.disconnect(true);
      }

      // Limpiar sesión usando IP
      await this.cleanupUserSession(socketId, pin, deviceId, ip);
      
      // Remover del mapa de actividad
      this.userActivityMap.delete(socketId);
      this.alreadyDisconnecting.delete(socketId);

      LoggerService.info('Inactive user disconnected', {
        socketId,
        pin,
        deviceId,
        reason: 'INACTIVITY_TIMEOUT'
      });

    } catch (error) {
      console.error(`Error desconectando usuario inactivo ${socketId}:`, error);
      LoggerService.error('Error disconnecting inactive user', {
        error: error.message,
        socketId,
        pin
      });
    }
  }

  /**
   * Limpia la sesión de un usuario
   * @param {string} socketId - ID del socket
   * @param {string} pin - PIN de la sala
   * @param {string} deviceId - ID del dispositivo
   */
  async cleanupUserSession(socketId, pin, deviceId, ip = null) {
    try {
      let deletedSessions;
      
      // Priorizar eliminación por IP (más confiable)
      if (ip) {
        deletedSessions = await DeviceSession.deleteMany({ ip, roomPin: pin });
      } else {
        // Fallback: eliminar por deviceId
        deletedSessions = await DeviceSession.deleteMany({ deviceId, roomPin: pin });
      }

      // Actualizar membership (priorizar búsqueda por IP)
      let membership;
      if (ip) {
        membership = await RoomMembership.findOne({ ip, roomPin: pin });
      } else {
        membership = await RoomMembership.findOne({ deviceId, roomPin: pin });
      }
      
      if (membership) {
        await membership.disconnect();
      }

      LoggerService.info('User session cleaned', {
        socketId,
        pin,
        deviceId,
        sessionsDeleted: deletedSessions.deletedCount
      });

    } catch (error) {
      console.error('Error limpiando sesión:', error);
      LoggerService.error('Error cleaning user session', {
        error: error.message,
        socketId,
        pin,
        deviceId
      });
    }
  }

  /**
   * Limpia sesiones huérfanas (sin socket activo)
   */
  async cleanOrphanSessions() {
    try {
      // Evitar consultas si la conexión a MongoDB está cerrada
      if (!mongoose.connection || mongoose.connection.readyState !== 1) {
        LoggerService.warn('Skipping cleanOrphanSessions: mongoose not connected', { readyState: mongoose.connection?.readyState });
        return;
      }

      const cutoffTime = new Date(Date.now() - INACTIVITY_CONFIG.ORPHAN_SESSION_CLEANUP);

      // Buscar sesiones antiguas
      const orphanSessions = await DeviceSession.find({
        lastActive: { $lt: cutoffTime }
      });

      if (orphanSessions.length > 0) {        
        for (const session of orphanSessions) {
          // Verificar si el socket todavía existe
          const socketExists = this.userActivityMap.has(session.deviceId);
          
          if (!socketExists) {
            await DeviceSession.deleteOne({ _id: session._id });
            
            // Actualizar membership
            const membership = await RoomMembership.findOne({
              deviceId: session.deviceId,
              roomPin: session.roomPin
            });
            
            if (membership) {
              await membership.disconnect();
            }
          }
        }

        LoggerService.info('Orphan sessions cleaned', {
          count: orphanSessions.length
        });
      }

    } catch (error) {
      console.error('Error limpiando sesiones huérfanas:', error);
      LoggerService.error('Error cleaning orphan sessions', {
        error: error.message
      });
    }
  }

  /**
   * Obtiene estadísticas del servicio
   * @returns {Object} Estadísticas
   */
  getStats() {
    return {
      activeUsers: this.userActivityMap.size,
      pendingDisconnections: this.disconnectionTimers.size,
      config: {
        maxInactivityTime: `${INACTIVITY_CONFIG.MAX_INACTIVITY_TIME / 1000}s`,
        checkInterval: `${INACTIVITY_CONFIG.CHECK_INTERVAL / 1000}s`,
        gracePeriod: `${INACTIVITY_CONFIG.RECONNECTION_GRACE_PERIOD / 1000}s`
      }
    };
  }
}

module.exports = { InactivityService, INACTIVITY_CONFIG };
