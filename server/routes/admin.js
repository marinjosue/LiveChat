const express = require('express');
const { AuthController } = require('../controllers/AuthController');
const { AuditService } = require('../services/auditService');
const { LoggerService } = require('../services/loggerService');
const Room = require('../models/Room');
const Message = require('../models/Message');
const Admin = require('../models/Admin');

const router = express.Router();

// Todas las rutas requieren autenticación
router.use(AuthController.verifyToken);

/**
 * @route   GET /api/admin/logs
 * @desc    Obtener logs de auditoría
 * @access  Private (Admin)
 */
router.get('/logs', async (req, res) => {
  try {
    const { 
      page = 1, 
      limit = 50, 
      action, 
      status, 
      startDate, 
      endDate 
    } = req.query;
    
    const result = await AuditService.getLogs({
      action,
      status,
      startDate,
      endDate
    }, {
      page: parseInt(page),
      limit: parseInt(limit)
    });
    
    res.json({
      success: true,
      ...result
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
});

/**
 * @route   POST /api/admin/logs/verify-integrity
 * @desc    Verificar integridad de los logs
 * @access  Private (Admin)
 */
router.post('/logs/verify-integrity', async (req, res) => {
  try {
    const { logIds } = req.body;
    
    const result = await AuditService.verifyLogsIntegrity(logIds);
    
    res.json({
      success: true,
      ...result
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
});

/**
 * @route   GET /api/admin/logs/files
 * @desc    Listar archivos de logs disponibles
 * @access  Private (Admin)
 */
router.get('/logs/files', async (req, res) => {
  try {
    const result = await LoggerService.listLogFiles();
    
    await AuditService.log({
      adminId: req.admin.adminId,
      adminUsername: req.admin.username,
      action: 'LOGS_FILES_LISTED',
      details: { filesCount: result.files?.length || 0 },
      ipAddress: req.ip,
      userAgent: req.headers['user-agent'],
      status: 'SUCCESS'
    });
    
    res.json(result);
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
});

/**
 * @route   GET /api/admin/logs/file/:filename
 * @desc    Obtener contenido de un archivo de log específico
 * @access  Private (Admin)
 */
router.get('/logs/file/:filename', async (req, res) => {
  try {
    const { filename } = req.params;
    const { lines = 100 } = req.query;
    
    // Validar filename para prevenir path traversal
    if (filename.includes('..') || filename.includes('/') || filename.includes('\\')) {
      return res.status(400).json({
        success: false,
        message: 'Invalid filename'
      });
    }
    
    const result = await LoggerService.getLogFile(filename, parseInt(lines));
    
    await AuditService.log({
      adminId: req.admin.adminId,
      adminUsername: req.admin.username,
      action: 'LOG_FILE_VIEWED',
      details: { filename, lines: parseInt(lines) },
      ipAddress: req.ip,
      userAgent: req.headers['user-agent'],
      status: result.success ? 'SUCCESS' : 'FAILURE'
    });
    
    res.json(result);
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
});

/**
 * @route   GET /api/admin/stats
 * @desc    Obtener estadísticas del sistema
 * @access  Private (Admin)
 */
router.get('/stats', async (req, res) => {
  try {
    const RoomModel = require('../models/RoomModel');
    
    const [totalMessages, totalAdmins, totalRooms, activeRooms] = await Promise.all([
      Message.countDocuments(),
      Admin.countDocuments(),
      RoomModel.countDocuments(),
      RoomModel.countDocuments({ isActive: true })
    ]);
    
    // Formatear uptime
    const uptimeSeconds = Math.floor(process.uptime());
    const days = Math.floor(uptimeSeconds / 86400);
    const hours = Math.floor((uptimeSeconds % 86400) / 3600);
    const minutes = Math.floor((uptimeSeconds % 3600) / 60);
    const uptimeFormatted = `${days}d ${hours}h ${minutes}m`;
    
    // Formatear memoria
    const memUsage = process.memoryUsage();
    const memUsedMB = Math.round(memUsage.heapUsed / 1024 / 1024);
    const memTotalMB = Math.round(memUsage.heapTotal / 1024 / 1024);
    
    const response = {
      success: true,
      totalMessages,
      totalAdmins,
      totalRooms,
      activeRooms,
      server: {
        uptime: uptimeFormatted,
        uptimeSeconds,
        memory: {
          usedMB: memUsedMB,
          totalMB: memTotalMB,
          rss: Math.round(memUsage.rss / 1024 / 1024),
          external: Math.round(memUsage.external / 1024 / 1024)
        },
        nodeVersion: process.version,
        platform: process.platform
      }
    };
    
    // Intentar obtener estadísticas de thread pools (opcional, no crítico)
    try {
      const { ThreadPoolManager } = require('../services/threadPoolManager');
      const { FileSecurityService } = require('../services/fileSecurityService');
      
      // Obtener estadísticas de los thread pools de forma segura
      const globalPool = ThreadPoolManager.getGlobalPool?.() || null;
      const authPool = ThreadPoolManager.getAuthPool?.() || null;
      const fileSecurityPool = FileSecurityService.getWorkerPoolStats?.() || null;
      
      if (globalPool || authPool || fileSecurityPool) {
        response.threadPools = {};
        
        if (globalPool) {
          response.threadPools.global = {
            totalWorkers: globalPool.workers?.total || 0,
            activeWorkers: globalPool.workers?.active || 0,
            idleWorkers: globalPool.workers?.idle || 0,
            queueSize: globalPool.tasks?.queued || 0,
            utilization: parseFloat(globalPool.utilization || 0) / 100,
            avgWaitTime: parseFloat(globalPool.performance?.avgWaitTime || 0),
            avgExecutionTime: parseFloat(globalPool.performance?.avgExecutionTime || 0),
            peakQueueSize: globalPool.performance?.peakQueueSize || 0,
            tasksCompleted: globalPool.tasks?.completed || 0,
            tasksFailed: globalPool.tasks?.failed || 0
          };
        }
        
        if (authPool) {
          response.threadPools.auth = {
            totalWorkers: authPool.workers?.total || 0,
            activeWorkers: authPool.workers?.active || 0,
            idleWorkers: authPool.workers?.idle || 0,
            queueSize: authPool.tasks?.queued || 0,
            utilization: parseFloat(authPool.utilization || 0) / 100,
            tasksCompleted: authPool.tasks?.completed || 0
          };
        }
        
        if (fileSecurityPool) {
          response.threadPools.fileSecurity = {
            totalWorkers: fileSecurityPool.workers?.total || 0,
            activeWorkers: fileSecurityPool.workers?.active || 0,
            idleWorkers: fileSecurityPool.workers?.idle || 0,
            queueSize: fileSecurityPool.tasks?.queued || 0,
            utilization: parseFloat(fileSecurityPool.utilization || 0) / 100,
            tasksCompleted: fileSecurityPool.tasks?.completed || 0
          };
        }
      }
    } catch (poolError) {
      // Si falla obtener stats de thread pools, continuar sin ellos
      console.error('Error obteniendo estadísticas de thread pools:', poolError.message);
      response.threadPools = {
        error: 'Thread pool stats not available'
      };
    }
    
    res.json(response);
  } catch (error) {
    console.error('Error en /api/admin/stats:', error);
    res.status(500).json({
      success: false,
      message: error.message,
      error: process.env.NODE_ENV === 'development' ? error.stack : undefined
    });
  }
});

/**
 * @route   GET /api/admin/messages/:pin
 * @desc    Obtener mensajes de una sala específica
 * @access  Private (Admin)
 */
router.get('/messages/:pin', async (req, res) => {
  try {
    const { pin } = req.params;
    const { page = 1, limit = 50 } = req.query;
    
    const skip = (page - 1) * limit;
    
    const [messages, total] = await Promise.all([
      Message.find({ pin })
        .sort({ timestamp: -1 })
        .skip(skip)
        .limit(parseInt(limit)),
      Message.countDocuments({ pin })
    ]);
    
    // Registrar en auditoría
    await AuditService.log({
      adminId: req.admin.adminId,
      adminUsername: req.admin.username,
      action: 'ROOM_VIEWED',
      details: { pin, messageCount: messages.length },
      ipAddress: req.ip,
      userAgent: req.headers['user-agent'],
      status: 'SUCCESS'
    });
    
    res.json({
      success: true,
      messages,
      total,
      page: parseInt(page),
      pages: Math.ceil(total / limit)
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
});

module.exports = router;
