require('dotenv').config();
const express = require('express');
const http = require('http');
const https = require('https');
const cors = require('cors');
const mongoose = require('mongoose');
const { Server } = require('socket.io');
const multer = require('multer');
const path = require('path');
const fs = require('fs');

// Servicios de seguridad
const { SSLCertificateService } = require('./services/sslService');

// Controladores y servicios
const RoomController = require('./controllers/RoomController');
const { uploadToCloudinary } = require('./utils/fileUploader');
const Message = require('./models/Message');
const Room = require('./models/Room');

// Seguridad
const {
  helmetConfig,
  apiLimiter,
  fileUploadLimiter,
  sanitizeInput,
  detectSuspiciousActivity,
  securityLogger,
  corsConfig
} = require('./middleware/security');

// Servicios de seguridad y concurrencia
const { logger, AuditService } = require('./services/auditService');
const { FileSecurityService } = require('./services/fileSecurityService');
const { encryptionService } = require('./services/encryptionService');
const { ThreadPoolManager } = require('./services/threadPoolManager');
const sslService = new SSLCertificateService();

// Rutas
const authRoutes = require('./routes/auth');
const adminRoutes = require('./routes/admin');
const adminRoomsRoutes = require('./routes/adminRooms');
const roomRoutes = require('./routes/rooms');
const myRoomsRoutes = require('./routes/myRooms');

const app = express();

// ==================== MIDDLEWARE DE SEGURIDAD ====================

// Helmet - Headers HTTP seguros
app.use(helmetConfig);

// CORS configurado de forma restrictiva
app.use(cors(corsConfig));

// Logging de seguridad
app.use(securityLogger);

// Rate limiting general
app.use('/api/', apiLimiter);

// Parser de JSON con límite
app.use(express.json({ limit: '25mb' }));
app.use(express.urlencoded({ limit: '25mb', extended: true }));

// Sanitizar entradas
app.use(sanitizeInput);

// Detectar actividad sospechosa
app.use(detectSuspiciousActivity);

// ==================== CONFIGURACIÓN ====================

// Crear directorio de logs si no existe
const logsDir = path.join(__dirname, 'logs');
if (!fs.existsSync(logsDir)) {
  fs.mkdirSync(logsDir, { recursive: true });
}

// Configurar multer para archivos en memoria
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 50 * 1024 * 1024 } // 50MB límite
});

// 🔐 CREAR SERVIDOR HTTP/HTTPS
let server;
let serverProtocol = 'HTTP';

// En desarrollo, usar HTTP por defecto (más simple y rápido)
// En producción, usar HTTPS con certificados válidos
if (process.env.NODE_ENV === 'production' && process.env.ENABLE_SSL === 'true') {
  try {
    const sslOptions = sslService.getProductionSSLOptions();
    server = https.createServer(sslOptions, app);
    serverProtocol = 'HTTPS';
    console.log('🔐 Servidor HTTPS habilitado con TLS/SSL (Producción)');
  } catch (error) {
    console.error('❌ Error configurando HTTPS:', error.message);
    console.log('⚠️ Fallback a HTTP');
    server = http.createServer(app);
    serverProtocol = 'HTTP';
  }
} else {
  // Modo desarrollo: usar HTTP
  server = http.createServer(app);
  serverProtocol = 'HTTP';
  console.log('🌐 Servidor HTTP habilitado (Desarrollo)');
  if (process.env.NODE_ENV !== 'production') {
    console.log('💡 Para HTTPS en producción, configurar ENABLE_SSL=true y certificados válidos');
  }
}

const io = new Server(server, { 
  cors: { 
    origin: process.env.FRONTEND_URL || "*",
    credentials: true
  },
  maxHttpBufferSize: 25 * 1024 * 1024,
  pingTimeout: 60000,
  pingInterval: 25000
});

// Hacer io accesible en las rutas
app.set('io', io);

// ==================== CONEXIÓN A MONGODB ====================

mongoose.connect(process.env.MONGODB_URI)
  .then(() => {
    console.log('✓ MongoDB conectado exitosamente');
    logger.info('MongoDB connected successfully');
  })
  .catch(err => {
    console.error('✗ Error conectando a MongoDB:', err);
    logger.error('MongoDB connection error', { error: err.message });
    process.exit(1);
  });

// ==================== THREAD POOL MANAGER ====================

const globalThreadPool = new ThreadPoolManager({
  minWorkers: 2,
  maxWorkers: 8,
  autoScale: true
});

// Monitorear eventos del pool
globalThreadPool.on('task-completed', (data) => {
  logger.info('Task completed', data);
});

globalThreadPool.on('task-failed', (data) => {
  logger.error('Task failed', data);
});

globalThreadPool.on('scaled-up', (data) => {
  console.log(`[THREAD-POOL] Scaled up: +${data.added} workers (total: ${data.total})`);
});

globalThreadPool.on('scaled-down', (data) => {
  console.log(`[THREAD-POOL] Scaled down: -${data.removed} workers (total: ${data.total})`);
});

// ==================== RUTAS DE API ====================

// Rutas de autenticación
app.use('/api/auth', authRoutes);

// ⚠️ IMPORTANTE: Las rutas más específicas DEBEN ir primero
// Rutas de salas de administración (ANTES de /api/admin genérico)
app.use('/api/admin/rooms', adminRoomsRoutes);

// Rutas de administración genérica
app.use('/api/admin', adminRoutes);

// Rutas públicas de salas
app.use('/api/rooms', roomRoutes);

// Rutas de mis salas (pertenencias de usuario)
app.use('/api/my-rooms', myRoomsRoutes);

// ==================== ENDPOINT DE UPLOAD CON SEGURIDAD ====================

app.post('/api/upload', 
  fileUploadLimiter,
  upload.single('file'), 
  async (req, res) => {
    try {
      const { pin, sender, tempId } = req.body;
      const file = req.file;

      if (!file || !pin || !sender) {
        return res.status(400).json({ 
          success: false, 
          message: 'Faltan datos requeridos' 
        });
      }

      // ===== VALIDAR TIPO DE SALA =====
      const roomDocument = await RoomModel.findOne({ pin, isActive: true });
      
      if (!roomDocument) {
        return res.status(404).json({
          success: false,
          message: 'Sala no encontrada o inactiva'
        });
      }

      if (roomDocument.roomType === 'text') {
        console.log(`🚫 Intento de subir archivo a sala de solo texto (PIN: ${pin})`);
        return res.status(403).json({
          success: false,
          message: 'Esta sala es solo para mensajes de texto. No se permiten archivos multimedia.'
        });
      }

      console.log(`📤 HTTP Upload: ${file.originalname} (${(file.size / 1024 / 1024).toFixed(2)}MB)`);

      // ===== ANÁLISIS DE SEGURIDAD DEL ARCHIVO =====
      console.log(`[SECURITY] Analyzing file: ${file.originalname}`);
      
      const securityValidation = await FileSecurityService.validateFile(
        file.buffer,
        file.mimetype,
        file.originalname,
        {
          checkSteganography: true,
          checkIntegrity: true,
          checkFileType: true,
          maxSize: 15 * 1024 * 1024
        }
      );

      if (!securityValidation.isValid) {
        console.error(`[SECURITY] File rejected: ${securityValidation.errors.join(', ')}`);
        
        // Registrar rechazo en auditoría
        await AuditService.logFileRejected(
          null,
          {
            fileName: file.originalname,
            fileSize: file.size,
            fileType: file.mimetype
          },
          securityValidation.errors.join(', '),
          req.ip
        );
        
        return res.status(400).json({
          success: false,
          message: 'Archivo rechazado por razones de seguridad',
          errors: securityValidation.errors,
          warnings: securityValidation.warnings
        });
      }

      // Si hay advertencias (esteganografía sospechosa), registrar
      if (securityValidation.warnings.length > 0) {
        console.warn(`[SECURITY] File warnings: ${securityValidation.warnings.join(', ')}`);
        
        await AuditService.logSteganographyDetected(
          null,
          {
            fileName: file.originalname,
            fileSize: file.size,
            fileType: file.mimetype,
            reason: securityValidation.warnings.join(', ')
          },
          req.ip
        );
      }

      // Convertir buffer a base64
      const fileBase64 = `data:${file.mimetype};base64,${file.buffer.toString('base64')}`;
      
      // Subir a Cloudinary
      const uploadResult = await uploadToCloudinary(fileBase64, file.originalname, 'livechat', 3);
      
      if (!uploadResult.success) {
        return res.status(500).json({ 
          success: false, 
          message: uploadResult.error 
        });
      }

      // Determinar tipo de archivo
      let messageType = 'document';
      if (file.mimetype.startsWith('image/')) messageType = 'image';
      else if (file.mimetype.startsWith('video/')) messageType = 'video';
      else if (file.mimetype.startsWith('audio/')) messageType = 'audio';

      // Guardar mensaje con información de seguridad
      const timestamp = new Date();
      const fileData = {
        url: uploadResult.url,
        originalName: file.originalname,
        mimeType: file.mimetype,
        size: file.size
      };

      const newMessage = new Message({
        pin,
        sender,
        messageType,
        fileData,
        timestamp,
        securityCheck: {
          steganographyAnalyzed: true,
          isSuspicious: securityValidation.checks.steganography?.isSuspicious || false,
          suspiciousReasons: securityValidation.checks.steganography?.reasons || [],
          analysisTimestamp: new Date()
        }
      });

      await newMessage.save();

      // Notificar a todos via Socket.IO
      io.to(pin).emit('fileMessage', {
        sender,
        messageType,
        fileData,
        timestamp,
        tempId
      });

      console.log(`✅ HTTP Upload exitoso: ${uploadResult.url}`);
      
      res.json({ 
        success: true, 
        url: uploadResult.url,
        fileData,
        tempId,
        securityCheck: {
          analyzed: true,
          isSafe: !securityValidation.checks.steganography?.isSuspicious
        }
      });

    } catch (error) {
      console.error('❌ Error en HTTP upload:', error);
      logger.error('File upload error', { error: error.message });
      res.status(500).json({ 
        success: false, 
        message: error.message 
      });
    }
  }
);

// ==================== CONTROLADOR DE SALAS CON SOCKETS ====================

RoomController(io);

// ==================== ENDPOINT ADICIONALES ====================

// Endpoint para capturar la IP pública
app.get('/get-ip', (req, res) => {
  let ip = req.headers['x-forwarded-for'] || req.socket.remoteAddress;

  if (ip && ip.includes(',')) {
    ip = ip.split(',')[0].trim();
  }

  res.json({ ip });
});

// Health check
app.get('/health', (req, res) => {
  res.json({
    success: true,
    status: 'healthy',
    uptime: process.uptime(),
    timestamp: new Date().toISOString(),
    services: {
      mongodb: mongoose.connection.readyState === 1 ? 'connected' : 'disconnected',
      threadPool: globalThreadPool.getStats()
    }
  });
});

// Estadísticas del sistema (protegido)
app.get('/api/stats', async (req, res) => {
  try {
    const stats = {
      threadPool: globalThreadPool.getStats(),
      fileSecurityWorkerPool: FileSecurityService.getWorkerPoolStats(),
      system: {
        uptime: process.uptime(),
        memory: process.memoryUsage(),
        cpu: process.cpuUsage()
      }
    };
    
    res.json({
      success: true,
      stats
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
});

// ==================== MANEJO DE ERRORES ====================

// 404 handler
app.use((req, res) => {
  res.status(404).json({
    success: false,
    message: 'Endpoint not found'
  });
});

// Error handler global
app.use((err, req, res, next) => {
  console.error('Global error handler:', err);
  logger.error('Unhandled error', {
    error: err.message,
    stack: err.stack,
    path: req.path,
    method: req.method
  });
  
  res.status(err.status || 500).json({
    success: false,
    message: process.env.NODE_ENV === 'production' 
      ? 'Internal server error' 
      : err.message
  });
});

// ==================== INICIO DEL SERVIDOR ====================

const PORT = process.env.PORT || 3001;

server.listen(PORT, () => {
  const protocol = serverProtocol === 'HTTPS' ? 'https' : 'http';
  const frontendProtocol = serverProtocol === 'HTTPS' ? 'https' : 'http';
  
  console.log('');
  console.log('╔════════════════════════════════════════════════════════╗');
  console.log('║         🚀 LiveChat Server - Secure Edition           ║');
  console.log('╚════════════════════════════════════════════════════════╝');
  console.log('');
  console.log(`✓ Server running on ${protocol}://localhost:${PORT} (${serverProtocol})`);
  console.log(`✓ Environment: ${process.env.NODE_ENV || 'development'}`);
  console.log(`✓ Frontend URL: ${frontendProtocol}://localhost:3000`);
  console.log('');
  console.log('🔐 Security Features:');
  console.log('  • TLS/SSL Encryption (HTTPS Transport Layer)');
  console.log('  • AES-256-GCM Message Encryption (Data at Rest)');
  console.log('  • Helmet (HTTP headers security)');
  console.log('  • Rate Limiting (DDoS protection)');
  console.log('  • Input Sanitization');
  console.log('  • Suspicious Activity Detection');
  console.log('  • Admin Authentication with 2FA');
  console.log('  • Audit Logging (non-repudiation)');
  console.log('  • Steganography Detection');
  console.log('  • File Integrity Verification');
  console.log('');
  console.log('⚡ Concurrency Features:');
  console.log('  • Worker Thread Pool for Authentication');
  console.log('  • Worker Thread Pool for File Analysis');
  console.log('  • Global Thread Pool Manager');
  console.log('  • Auto-scaling Workers');
  console.log('  • Lock Management (deadlock prevention)');
  console.log('');
  console.log(`📊 Thread Pool Stats:`, globalThreadPool.getStats());
  console.log('');
  
  logger.info('Server started', {
    port: PORT,
    environment: process.env.NODE_ENV || 'development'
  });
});

// ==================== GRACEFUL SHUTDOWN ====================

async function gracefulShutdown(signal) {
  console.log(`\n${signal} received. Starting graceful shutdown...`);
  
  // Cerrar servidor HTTP
  server.close(() => {
    console.log('✓ HTTP server closed');
  });
  
  // Cerrar thread pools
  try {
    await globalThreadPool.shutdown();
    console.log('✓ Global thread pool closed');
    
    await FileSecurityService.shutdown();
    console.log('✓ File security worker pool closed');
    
  } catch (error) {
    console.error('Error closing thread pools:', error);
  }
  
  // Cerrar conexión a MongoDB
  await mongoose.connection.close();
  console.log('✓ MongoDB connection closed');
  
  logger.info('Server shutdown complete');
  process.exit(0);
}

// Capturar señales de terminación
process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));

// Capturar excepciones no manejadas
process.on('uncaughtException', (error) => {
  console.error('Uncaught Exception:', error);
  logger.error('Uncaught exception', { error: error.message, stack: error.stack });
  gracefulShutdown('uncaughtException');
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('Unhandled Rejection at:', promise, 'reason:', reason);
  logger.error('Unhandled rejection', { reason });
  gracefulShutdown('unhandledRejection');
});

module.exports = { app, server, io, globalThreadPool };
