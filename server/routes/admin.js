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
    
    const { ThreadPoolManager } = require('../services/threadPoolManager');
    const { FileSecurityService } = require('../services/fileSecurityService');
    
    // Obtener estadísticas de los thread pools
    const globalPool = ThreadPoolManager.getGlobalPool();
    const authPool = ThreadPoolManager.getAuthPool();
    const fileSecurityPool = FileSecurityService.getWorkerPoolStats();
    
    // Formatear uptime
    const uptimeSeconds = Math.floor(process.uptime());
    const days = Math.floor(uptimeSeconds / 86400);
    const hours = Math.floor((uptimeSeconds % 86400) / 3600);
    const minutes = Math.floor((uptimeSeconds % 3600) / 60);
    const uptimeFormatted = `${days}d ${hours}h ${minutes}m`;
    
    // Formatear memoria
    const memUsage = process.memoryUsage();
    const memUsedMB = memUsage.heapUsed / 1024 / 1024;
    const memTotalMB = memUsage.heapTotal / 1024 / 1024;
    
    res.json({
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
          rss: memUsage.rss / 1024 / 1024,
          external: memUsage.external / 1024 / 1024
        },
        nodeVersion: process.version,
        platform: process.platform
      },
      threadPools: {
        global: {
          totalWorkers: globalPool.workers.total,
          activeWorkers: globalPool.workers.active,
          idleWorkers: globalPool.workers.idle,
          queueSize: globalPool.tasks.queued,
          utilization: parseFloat(globalPool.utilization) / 100,
          avgWaitTime: parseFloat(globalPool.performance.avgWaitTime),
          avgExecutionTime: parseFloat(globalPool.performance.avgExecutionTime),
          peakQueueSize: globalPool.performance.peakQueueSize,
          tasksCompleted: globalPool.tasks.completed,
          tasksFailed: globalPool.tasks.failed
        },
        auth: {
          totalWorkers: authPool.workers.total,
          activeWorkers: authPool.workers.active,
          idleWorkers: authPool.workers.idle,
          queueSize: authPool.tasks.queued,
          utilization: parseFloat(authPool.utilization) / 100,
          tasksCompleted: authPool.tasks.completed
        },
        fileSecurity: {
          totalWorkers: fileSecurityPool.workers.total,
          activeWorkers: fileSecurityPool.workers.active,
          idleWorkers: fileSecurityPool.workers.idle,
          queueSize: fileSecurityPool.tasks.queued,
          utilization: parseFloat(fileSecurityPool.utilization) / 100,
          tasksCompleted: fileSecurityPool.tasks.completed
        }
      }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
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
