const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const { body, validationResult } = require('express-validator');

/**
 * Configuración de Helmet para headers HTTP seguros
 */
const helmetConfig = helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'", "'unsafe-inline'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      imgSrc: ["'self'", "data:", "https:", "blob:"],
      connectSrc: ["'self'", process.env.FRONTEND_URL || "*"],
      fontSrc: ["'self'", "data:"],
      objectSrc: ["'none'"],
      mediaSrc: ["'self'", "https:"],
      frameSrc: ["'none'"]
    }
  },
  crossOriginEmbedderPolicy: false,
  crossOriginResourcePolicy: { policy: "cross-origin" },
  dnsPrefetchControl: { allow: false },
  frameguard: { action: 'deny' },
  hidePoweredBy: true,
  hsts: {
    maxAge: 31536000,
    includeSubDomains: true,
    preload: true
  },
  ieNoOpen: true,
  noSniff: true,
  referrerPolicy: { policy: 'strict-origin-when-cross-origin' },
  xssFilter: true
});

/**
 * Rate limiting para autenticación
 * Previene ataques de fuerza bruta
 */
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutos
  max: 5, // 5 intentos por ventana
  message: 'Demasiados intentos de autenticación. Intenta de nuevo en 15 minutos.',
  standardHeaders: true,
  legacyHeaders: false,
  skipSuccessfulRequests: false,
  handler: (req, res) => {
    res.status(429).json({
      success: false,
      message: 'Demasiados intentos de autenticación. Intenta de nuevo más tarde.',
      retryAfter: 15 * 60
    });
  }
});

/**
 * Rate limiting general para API
 */
const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutos
  max: 100, // 100 requests por ventana
  message: 'Demasiadas solicitudes desde esta IP. Intenta de nuevo más tarde.',
  standardHeaders: true,
  legacyHeaders: false,
  skipSuccessfulRequests: true
});

/**
 * Rate limiting para creación de salas
 */
const roomCreationLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hora
  max: 10, // 10 salas por hora
  message: 'Demasiadas salas creadas. Intenta de nuevo en 1 hora.',
  standardHeaders: true,
  legacyHeaders: false,
  skipSuccessfulRequests: false
});

/**
 * Rate limiting para subida de archivos
 */
const fileUploadLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutos
  max: 30, // 30 archivos por ventana
  message: 'Demasiados archivos subidos. Intenta de nuevo más tarde.',
  standardHeaders: true,
  legacyHeaders: false
});

/**
 * Middleware para sanitizar entradas
 */
const sanitizeInput = (req, res, next) => {
  // Sanitizar body
  if (req.body) {
    Object.keys(req.body).forEach(key => {
      if (typeof req.body[key] === 'string') {
        // Eliminar caracteres peligrosos
        req.body[key] = req.body[key]
          .replace(/<script[^>]*>.*?<\/script>/gi, '')
          .replace(/<[^>]+>/g, '')
          .trim();
      }
    });
  }
  
  next();
};

/**
 * Middleware para validar origen de la solicitud
 */
const validateOrigin = (req, res, next) => {
  const origin = req.headers.origin;
  const referer = req.headers.referer;
  const allowedOrigins = [
    process.env.FRONTEND_URL,
    'http://localhost:3000',
    'http://localhost'
  ].filter(Boolean);
  
  // Permitir solicitudes sin origen (como Postman) solo en desarrollo
  if (!origin && !referer && process.env.NODE_ENV === 'development') {
    return next();
  }
  
  // Verificar origen
  if (origin && allowedOrigins.includes(origin)) {
    return next();
  }
  
  // Verificar referer como fallback
  if (referer) {
    const isAllowed = allowedOrigins.some(allowed => referer.startsWith(allowed));
    if (isAllowed) {
      return next();
    }
  }
  
  // Registrar intento sospechoso
  console.warn(`[SECURITY] Blocked request from unauthorized origin: ${origin || referer || 'unknown'}`);
  
  res.status(403).json({
    success: false,
    message: 'Forbidden: Invalid origin'
  });
};

/**
 * Middleware para detectar actividad sospechosa
 */
const detectSuspiciousActivity = (req, res, next) => {
  const suspicious = [];
  
  // Detectar SQL injection
  const sqlPattern = /'|--|;|\/\*|\*\/|xp_|sp_|exec|execute|select|insert|update|delete|drop|create|alter/gi;
  const bodyStr = JSON.stringify(req.body);
  if (sqlPattern.test(bodyStr)) {
    suspicious.push('SQL_INJECTION_ATTEMPT');
  }
  // Detectar XSS
  const xssPattern = /<script|javascript:|onerror=|onload=/gi;
  if (xssPattern.test(bodyStr)) {
    suspicious.push('XSS_ATTEMPT');
  }
  
  // Detectar path traversal
  const pathPattern = /\.\.\//g;
  if (pathPattern.test(bodyStr)) {
    suspicious.push('PATH_TRAVERSAL_ATTEMPT');
  }
  
  // Si se detecta actividad sospechosa
  if (suspicious.length > 0) {
    console.warn(`[SECURITY] Suspicious activity detected: ${suspicious.join(', ')}`);
    console.warn(`[SECURITY] IP: ${req.ip}, User-Agent: ${req.headers['user-agent']}`);
    
    // Registrar en auditoría si está disponible
    const { AuditService } = require('../services/auditService');
    AuditService.logSuspiciousActivity({
      types: suspicious,
      body: req.body,
      path: req.path,
      method: req.method
    }, req.ip, req.headers['user-agent']).catch(err => {
      console.error('[SECURITY] Error logging suspicious activity:', err);
    });
    
    return res.status(400).json({
      success: false,
      message: 'Bad request'
    });
  }
  
  next();
};

/**
 * Middleware para prevenir CSRF
 */
const csrfProtection = (req, res, next) => {
  // Solo aplicar a métodos que modifican estado
  if (['POST', 'PUT', 'DELETE', 'PATCH'].includes(req.method)) {
    const token = req.headers['x-csrf-token'];
    const sessionToken = req.session?.csrfToken;
    
    // En desarrollo, permitir solicitudes sin token
    if (process.env.NODE_ENV === 'development') {
      return next();
    }
    
    if (!token || token !== sessionToken) {
      console.warn(`[SECURITY] CSRF token mismatch for ${req.path}`);
      return res.status(403).json({
        success: false,
        message: 'Invalid CSRF token'
      });
    }
  }
  
  next();
};

/**
 * Middleware para logging de seguridad
 */
const securityLogger = (req, res, next) => {
  const startTime = Date.now();
  
  // Interceptar respuesta
  const originalSend = res.send;
  res.send = function(data) {
    const duration = Date.now() - startTime;
    
    // Loguear solo errores y solicitudes sospechosas
    if (res.statusCode >= 400) {
      console.log(`[SECURITY] ${req.method} ${req.path} - ${res.statusCode} (${duration}ms) - IP: ${req.ip}`);
    }
    
    return originalSend.call(this, data);
  };
  
  next();
};

/**
 * Configuración de CORS restrictiva
 */
const corsConfig = {
  origin: function (origin, callback) {
    const allowedOrigins = [
      process.env.FRONTEND_URL,
      'http://localhost:3000',
      'http://localhost'
    ].filter(Boolean);

    if (!origin) return callback(null, true);

    if (allowedOrigins.includes(origin)) {
      return callback(null, true);
    }

    console.warn(`[SECURITY] Blocked CORS request from: ${origin}`);
    return callback(new Error('Not allowed by CORS'));
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-CSRF-Token'],
  exposedHeaders: ['Content-Range', 'X-Content-Range'],
  maxAge: 86400
};


module.exports = {
  helmetConfig,
  authLimiter,
  apiLimiter,
  roomCreationLimiter,
  fileUploadLimiter,
  sanitizeInput,
  validateOrigin,
  detectSuspiciousActivity,
  csrfProtection,
  securityLogger,
  corsConfig
};
