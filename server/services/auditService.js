const winston = require('winston');
require('winston-mongodb');
const AuditLog = require('../models/AuditLog');

// Configuración del logger con Winston
const logger = winston.createLogger({
  level: 'info',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.errors({ stack: true }),
    winston.format.json()
  ),
  defaultMeta: { service: 'livechat-server' },
  transports: [
    // Logs de errores en archivo
    new winston.transports.File({ 
      filename: 'logs/error.log', 
      level: 'error',
      maxsize: 5242880, // 5MB
      maxFiles: 5,
    }),
    // Logs generales en archivo
    new winston.transports.File({ 
      filename: 'logs/combined.log',
      maxsize: 5242880, // 5MB
      maxFiles: 5,
    }),
    // Logs de auditoría en MongoDB (opcional, adicional al modelo AuditLog)
    new winston.transports.MongoDB({
      db: process.env.MONGODB_URI,
      collection: 'system_logs',
      level: 'info',
      options: { useUnifiedTopology: true },
      tryReconnect: true,
      decolorize: true,
      expireAfterSeconds: 7776000, // 90 días
    })
  ],
  // Manejar excepciones no capturadas
  exceptionHandlers: [
    new winston.transports.File({ filename: 'logs/exceptions.log' })
  ],
  // Manejar rechazos de promesas no capturados
  rejectionHandlers: [
    new winston.transports.File({ filename: 'logs/rejections.log' })
  ]
});

// En desarrollo, también loguear a consola
if (process.env.NODE_ENV !== 'production') {
  logger.add(new winston.transports.Console({
    format: winston.format.combine(
      winston.format.colorize(),
      winston.format.simple()
    )
  }));
}

/**
 * Servicio de auditoría para registrar acciones del administrador
 */
class AuditService {
  /**
   * Registra una acción de auditoría
   * @param {Object} params - Parámetros del log
   * @param {String} params.adminId - ID del administrador
   * @param {String} params.adminUsername - Username del administrador
   * @param {String} params.action - Acción realizada
   * @param {Object} params.details - Detalles adicionales
   * @param {String} params.ipAddress - IP del cliente
   * @param {String} params.userAgent - User agent
   * @param {String} params.status - Estado (SUCCESS, FAILURE, WARNING)
   * @param {String} params.errorMessage - Mensaje de error (opcional)
   */
  static async log({
    adminId,
    adminUsername,
    action,
    details = {},
    ipAddress,
    userAgent = null,
    status = 'SUCCESS',
    errorMessage = null
  }) {
    try {
      // Crear log en MongoDB con hash de integridad
      await AuditLog.createLog({
        adminId,
        adminUsername,
        action,
        details,
        ipAddress,
        userAgent,
        status,
        errorMessage,
        timestamp: new Date()
      });

      // También loguear con Winston
      logger.info({
        type: 'AUDIT',
        adminId,
        adminUsername,
        action,
        details,
        ipAddress,
        status
      });

      console.log(`[AUDIT] ${action} by ${adminUsername} - ${status}`);
    } catch (error) {
      // Error crítico: no se pudo registrar el log de auditoría
      logger.error('Failed to create audit log', {
        error: error.message,
        action,
        adminUsername
      });
      console.error('Error crítico en auditoría:', error);
    }
  }

  /**
   * Registra un intento de login exitoso
   */
  static async logLoginSuccess(admin, ipAddress, userAgent) {
    await this.log({
      adminId: admin._id,
      adminUsername: admin.username,
      action: 'LOGIN_SUCCESS',
      details: { email: admin.email },
      ipAddress,
      userAgent,
      status: 'SUCCESS'
    });
  }

  /**
   * Registra un intento de login fallido
   */
  static async logLoginFailure(username, ipAddress, userAgent, reason) {
    await this.log({
      adminId: null,
      adminUsername: username || 'UNKNOWN',
      action: 'LOGIN_FAILED',
      details: { reason },
      ipAddress,
      userAgent,
      status: 'FAILURE',
      errorMessage: reason
    });
  }

  /**
   * Registra una verificación 2FA exitosa
   */
  static async log2FASuccess(admin, ipAddress, userAgent) {
    await this.log({
      adminId: admin._id,
      adminUsername: admin.username,
      action: '2FA_VERIFIED',
      ipAddress,
      userAgent,
      status: 'SUCCESS'
    });
  }

  /**
   * Registra una verificación 2FA fallida
   */
  static async log2FAFailure(admin, ipAddress, userAgent) {
    await this.log({
      adminId: admin._id,
      adminUsername: admin.username,
      action: '2FA_FAILED',
      ipAddress,
      userAgent,
      status: 'FAILURE',
      errorMessage: 'Invalid 2FA code'
    });
  }

  /**
   * Registra la creación de una sala
   */
  static async logRoomCreated(admin, roomData, ipAddress) {
    await this.log({
      adminId: admin._id,
      adminUsername: admin.username,
      action: 'ROOM_CREATED',
      details: {
        pin: roomData.pin,
        roomType: roomData.roomType,
        limit: roomData.limit,
        maxFileSize: roomData.maxFileSize
      },
      ipAddress,
      status: 'SUCCESS'
    });
  }

  /**
   * Registra la detección de esteganografía
   */
  static async logSteganographyDetected(admin, fileData, ipAddress) {
    await this.log({
      adminId: admin._id,
      adminUsername: admin.username,
      action: 'STEGANOGRAPHY_DETECTED',
      details: {
        fileName: fileData.fileName,
        fileSize: fileData.fileSize,
        fileType: fileData.fileType,
        reason: fileData.reason
      },
      ipAddress,
      status: 'WARNING',
      errorMessage: 'Steganography detected in uploaded file'
    });
  }

  /**
   * Registra un archivo rechazado
   */
  static async logFileRejected(admin, fileData, reason, ipAddress) {
    await this.log({
      adminId: admin ? admin._id : null,
      adminUsername: admin ? admin.username : 'SYSTEM',
      action: 'FILE_REJECTED',
      details: {
        fileName: fileData.fileName,
        fileSize: fileData.fileSize,
        fileType: fileData.fileType,
        reason
      },
      ipAddress,
      status: 'WARNING',
      errorMessage: reason
    });
  }

  /**
   * Registra actividad sospechosa
   */
  static async logSuspiciousActivity(details, ipAddress, userAgent) {
    await this.log({
      adminId: null,
      adminUsername: 'SYSTEM',
      action: 'SUSPICIOUS_ACTIVITY',
      details,
      ipAddress,
      userAgent,
      status: 'WARNING',
      errorMessage: 'Suspicious activity detected'
    });
  }

  /**
   * Obtiene logs de auditoría con filtros
   */
  static async getLogs(filters = {}, options = {}) {
    const {
      adminId,
      action,
      status,
      startDate,
      endDate,
      page = 1,
      limit = 50
    } = { ...filters, ...options };

    const query = {};

    if (adminId) query.adminId = adminId;
    if (action) query.action = action;
    if (status) query.status = status;
    if (startDate || endDate) {
      query.timestamp = {};
      if (startDate) query.timestamp.$gte = new Date(startDate);
      if (endDate) query.timestamp.$lte = new Date(endDate);
    }

    const skip = (page - 1) * limit;

    const [logs, total] = await Promise.all([
      AuditLog.find(query)
        .sort({ timestamp: -1 })
        .skip(skip)
        .limit(limit)
        .lean(),
      AuditLog.countDocuments(query)
    ]);

    return {
      logs,
      total,
      page,
      pages: Math.ceil(total / limit)
    };
  }

  /**
   * Verifica la integridad de los logs
   */
  static async verifyLogsIntegrity(logIds = null) {
    const query = logIds ? { _id: { $in: logIds } } : {};
    const logs = await AuditLog.find(query);

    const results = {
      total: logs.length,
      valid: 0,
      invalid: 0,
      invalidLogs: []
    };

    for (const log of logs) {
      const isValid = log.verifyIntegrity();
      if (isValid) {
        results.valid++;
      } else {
        results.invalid++;
        results.invalidLogs.push({
          id: log._id,
          action: log.action,
          timestamp: log.timestamp
        });
      }
    }

    return results;
  }
}

module.exports = { logger, AuditService };
