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
    const [totalMessages, totalAdmins] = await Promise.all([
      Message.countDocuments(),
      Admin.countDocuments()
    ]);
    
    const { ThreadPoolManager } = require('../services/threadPoolManager');
    const { FileSecurityService } = require('../services/fileSecurityService');
    
    res.json({
      success: true,
      stats: {
        totalMessages,
        totalAdmins,
        fileSecurityWorkerPool: FileSecurityService.getWorkerPoolStats(),
        uptime: process.uptime(),
        memory: process.memoryUsage(),
        nodeVersion: process.version
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
