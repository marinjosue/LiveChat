const path = require('path');
const fs = require('fs').promises;
const winston = require('winston');
require('winston-mongodb');

// Asegurar que existe el directorio de logs
const logsDir = path.join(__dirname, '../logs');

// Función para crear el directorio de logs si no existe
const ensureLogDir = async () => {
  try {
    await fs.access(logsDir);
  } catch {
    await fs.mkdir(logsDir, { recursive: true });
    console.log('Directorio de logs creado:', logsDir);
  }
};

// Crear directorio inmediatamente
ensureLogDir().catch(console.error);

// Formato personalizado para archivos
const fileFormat = winston.format.combine(
  winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
  winston.format.errors({ stack: true }),
  winston.format.json()
);

// Formato personalizado para consola
const consoleFormat = winston.format.combine(
  winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
  winston.format.colorize(),
  winston.format.printf(({ timestamp, level, message, ...meta }) => {
    let metaStr = '';
    if (Object.keys(meta).length > 0) {
      metaStr = '\n' + JSON.stringify(meta, null, 2);
    }
    return `${timestamp} [${level}]: ${message}${metaStr}`;
  })
);

// Logger principal
const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || 'info',
  format: fileFormat,
  defaultMeta: { service: 'livechat-server' },
  transports: [
    // Logs de errores
    new winston.transports.File({
      filename: path.join(logsDir, 'error.log'),
      level: 'error',
      maxsize: 10485760, // 10MB
      maxFiles: 10,
      tailable: true
    }),
    
    // Logs de advertencias
    new winston.transports.File({
      filename: path.join(logsDir, 'warnings.log'),
      level: 'warn',
      maxsize: 5242880, // 5MB
      maxFiles: 5,
      tailable: true
    }),
    
    // Logs combinados
    new winston.transports.File({
      filename: path.join(logsDir, 'combined.log'),
      maxsize: 10485760, // 10MB
      maxFiles: 10,
      tailable: true
    }),
    
    // Logs de auditoría de seguridad
    new winston.transports.File({
      filename: path.join(logsDir, 'security.log'),
      level: 'info',
      maxsize: 10485760, // 10MB
      maxFiles: 15,
      tailable: true,
      format: winston.format.combine(
        winston.format.timestamp(),
        winston.format.json()
      )
    }),
    
    // Logs de actividad de salas
    new winston.transports.File({
      filename: path.join(logsDir, 'rooms.log'),
      level: 'info',
      maxsize: 5242880, // 5MB
      maxFiles: 5,
      tailable: true
    }),
    
    // Logs de archivos/uploads
    new winston.transports.File({
      filename: path.join(logsDir, 'uploads.log'),
      level: 'info',
      maxsize: 10485760, // 10MB
      maxFiles: 10,
      tailable: true
    })
  ],
  
  // Excepciones no capturadas
  exceptionHandlers: [
    new winston.transports.File({
      filename: path.join(logsDir, 'exceptions.log'),
      maxsize: 10485760,
      maxFiles: 5
    })
  ],
  
  // Promesas rechazadas
  rejectionHandlers: [
    new winston.transports.File({
      filename: path.join(logsDir, 'rejections.log'),
      maxsize: 10485760,
      maxFiles: 5
    })
  ]
});

// Añadir transporte MongoDB si está configurado
if (process.env.MONGODB_URI) {
  logger.add(new winston.transports.MongoDB({
    db: process.env.MONGODB_URI,
    collection: 'system_logs',
    level: 'info',
    options: { useUnifiedTopology: true },
    tryReconnect: true,
    decolorize: true,
    expireAfterSeconds: 7776000, // 90 días
    metaKey: 'metadata'
  }));
}

// Añadir consola en desarrollo
if (process.env.NODE_ENV !== 'production') {
  logger.add(new winston.transports.Console({
    format: consoleFormat
  }));
}

/**
 * Servicio centralizado de logging
 */
class LoggerService {
  /**
   * Log de información general
   */
  static info(message, meta = {}) {
    logger.info(message, meta);
  }

  /**
   * Log de advertencia
   */
  static warn(message, meta = {}) {
    logger.warn(message, meta);
  }

  /**
   * Log de error
   */
  static error(message, meta = {}) {
    logger.error(message, meta);
  }

  /**
   * Log de debug
   */
  static debug(message, meta = {}) {
    logger.debug(message, meta);
  }

  /**
   * Log de seguridad/auditoría
   */
  static security(action, details = {}) {
    logger.info(`[SECURITY] ${action}`, {
      ...details,
      logType: 'security',
      timestamp: new Date().toISOString()
    });
  }

  /**
   * Log de actividad de salas
   */
  static room(action, roomPin, details = {}) {
    logger.info(`[ROOM] ${action} - ${roomPin}`, {
      ...details,
      logType: 'room',
      roomPin,
      timestamp: new Date().toISOString()
    });
  }

  /**
   * Log de subida de archivos
   */
  static upload(action, fileName, details = {}) {
    logger.info(`[UPLOAD] ${action} - ${fileName}`, {
      ...details,
      logType: 'upload',
      fileName,
      timestamp: new Date().toISOString()
    });
  }

  /**
   * Log de esteganografía detectada
   */
  static steganography(fileName, confidence, reasons, details = {}) {
    logger.warn(`[STEGANOGRAPHY] Detected in ${fileName} (${confidence}% confidence)`, {
      ...details,
      logType: 'steganography',
      fileName,
      confidence,
      reasons,
      timestamp: new Date().toISOString()
    });
  }

  /**
   * Obtener logs de un archivo específico
   */
  static async getLogFile(filename, lines = 100) {
    try {
      const filePath = path.join(logsDir, filename);
      const content = await fs.readFile(filePath, 'utf-8');
      const allLines = content.trim().split('\n');
      
      // Obtener las últimas N líneas
      const recentLines = allLines.slice(-lines);
      
      return {
        success: true,
        filename,
        totalLines: allLines.length,
        lines: recentLines.map(line => {
          try {
            return JSON.parse(line);
          } catch {
            return { raw: line };
          }
        })
      };
    } catch (error) {
      return {
        success: false,
        error: error.message,
        filename
      };
    }
  }

  /**
   * Listar archivos de logs disponibles
   */
  static async listLogFiles() {
    try {
      const files = await fs.readdir(logsDir);
      const logFiles = files.filter(f => f.endsWith('.log'));
      
      const fileStats = await Promise.all(
        logFiles.map(async (file) => {
          const stats = await fs.stat(path.join(logsDir, file));
          return {
            name: file,
            size: stats.size,
            modified: stats.mtime,
            sizeFormatted: this.formatBytes(stats.size)
          };
        })
      );

      return {
        success: true,
        files: fileStats.sort((a, b) => b.modified - a.modified)
      };
    } catch (error) {
      return {
        success: false,
        error: error.message,
        files: []
      };
    }
  }

  /**
   * Formatear bytes a tamaño legible
   */
  static formatBytes(bytes) {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return Math.round(bytes / Math.pow(k, i) * 100) / 100 + ' ' + sizes[i];
  }

  /**
   * Limpiar logs antiguos
   */
  static async cleanOldLogs(daysOld = 30) {
    try {
      const files = await fs.readdir(logsDir);
      const cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() - daysOld);

      let deletedCount = 0;

      for (const file of files) {
        if (!file.endsWith('.log')) continue;
        
        const filePath = path.join(logsDir, file);
        const stats = await fs.stat(filePath);

        if (stats.mtime < cutoffDate) {
          await fs.unlink(filePath);
          deletedCount++;
          logger.info(`Deleted old log file: ${file}`);
        }
      }

      return {
        success: true,
        deletedCount,
        message: `Deleted ${deletedCount} old log files`
      };
    } catch (error) {
      return {
        success: false,
        error: error.message
      };
    }
  }
}

module.exports = { logger, LoggerService };
