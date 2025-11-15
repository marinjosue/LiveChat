const jwt = require('jsonwebtoken');
const speakeasy = require('speakeasy');
const QRCode = require('qrcode');
const Admin = require('../models/Admin');
const { AuditService } = require('../services/auditService');
const { createHashWorker, createVerifyWorker, createIntegrityWorker, WorkerPool } = require('../services/workerPoolService');
const { body, validationResult } = require('express-validator');
const path = require('path');

// Pool de workers para autenticación concurrente
const authWorkerPool = new WorkerPool(
  path.join(__dirname, '../workers/verifyWorker.js'),
  4 // 4 workers concurrentes
);

const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key-change-in-production';
const JWT_EXPIRES_IN = '24h';

/**
 * Validación de entrada para registro
 */
const validateRegister = [
  body('username').trim().isLength({ min: 3, max: 50 }).isAlphanumeric(),
  body('email').trim().isEmail().normalizeEmail(),
  body('password').isLength({ min: 8 }).matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])/),
  body('role').optional().isIn(['admin', 'moderator', 'superadmin'])
];

/**
 * Validación de entrada para login
 */
const validateLogin = [
  body('username').trim().notEmpty(),
  body('password').notEmpty()
];

/**
 * Extrae IP del request
 */
const getClientIp = (req) => {
  return req.headers['x-forwarded-for']?.split(',')[0] || 
         req.socket.remoteAddress || 
         req.ip;
};

/**
 * Controlador de autenticación de administradores
 */
class AuthController {
  /**
   * Registrar nuevo administrador
   * Usa Worker Thread para hashing de contraseña
   */
  static async register(req, res) {
    try {
      // Validar entrada
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ success: false, errors: errors.array() });
      }

      const { username, email, password, role = 'admin' } = req.body;
      const ipAddress = getClientIp(req);
      const userAgent = req.headers['user-agent'];

      // Verificar si el usuario ya existe
      const existingAdmin = await Admin.findOne({ 
        $or: [{ username }, { email }] 
      });

      if (existingAdmin) {
        await AuditService.log({
          adminId: null,
          adminUsername: username,
          action: 'ADMIN_CREATED',
          status: 'FAILURE',
          errorMessage: 'Username or email already exists',
          ipAddress,
          userAgent
        });

        return res.status(400).json({ 
          success: false, 
          message: 'Usuario o email ya existe' 
        });
      }

      // Hashear contraseña usando Worker Thread (proceso CPU-intensivo)
      console.log(`[AUTH] Hashing password for ${username} in worker thread...`);
      const hashResult = await createHashWorker(password);

      if (!hashResult.success) {
        throw new Error('Error al hashear contraseña');
      }

      // Crear administrador
      const admin = new Admin({
        username,
        email,
        passwordHash: hashResult.hash,
        role
      });

      await admin.save();

      // Registrar en auditoría
      await AuditService.log({
        adminId: admin._id,
        adminUsername: admin.username,
        action: 'ADMIN_CREATED',
        details: { email, role },
        ipAddress,
        userAgent,
        status: 'SUCCESS'
      });

      console.log(`[AUTH] Admin created: ${username}`);

      res.status(201).json({
        success: true,
        message: 'Administrador creado exitosamente',
        admin: admin.toSecureJSON()
      });

    } catch (error) {
      console.error('[AUTH] Error en register:', error);
      res.status(500).json({ 
        success: false, 
        message: 'Error al crear administrador',
        error: error.message 
      });
    }
  }

  /**
   * Login de administrador con verificación en Worker Thread
   * Soporta autenticación concurrente
   */
  static async login(req, res) {
    try {
      // Validar entrada
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ success: false, errors: errors.array() });
      }

      const { username, password } = req.body;
      const ipAddress = getClientIp(req);
      const userAgent = req.headers['user-agent'];

      console.log(`[AUTH] Login attempt for ${username} from ${ipAddress}`);

      // Buscar administrador
      const admin = await Admin.findOne({ username });

      if (!admin) {
        await AuditService.logLoginFailure(username, ipAddress, userAgent, 'User not found');
        return res.status(401).json({ 
          success: false, 
          message: 'Credenciales inválidas' 
        });
      }

      // Verificar si la cuenta está bloqueada
      if (admin.isLocked) {
        const timeLeft = Math.ceil((admin.lockUntil - Date.now()) / 1000 / 60);
        await AuditService.logLoginFailure(username, ipAddress, userAgent, 'Account locked');
        
        return res.status(423).json({ 
          success: false, 
          message: `Cuenta bloqueada. Intenta de nuevo en ${timeLeft} minutos.` 
        });
      }

      // Verificar contraseña usando Worker Thread Pool (concurrente)
      console.log(`[AUTH] Verifying password for ${username} in worker thread...`);
      const verifyResult = await authWorkerPool.runTask({
        password,
        hash: admin.passwordHash
      });

      if (!verifyResult.success || !verifyResult.isMatch) {
        await admin.incrementFailedAttempts();
        await AuditService.logLoginFailure(username, ipAddress, userAgent, 'Invalid password');
        
        return res.status(401).json({ 
          success: false, 
          message: 'Credenciales inválidas' 
        });
      }

      // Verificar si tiene 2FA habilitado
      if (admin.isEnabled2FA) {
        // Generar token temporal para verificación 2FA
        const tempToken = jwt.sign(
          { adminId: admin._id, temp: true },
          JWT_SECRET,
          { expiresIn: '5m' }
        );

        return res.json({
          success: true,
          requires2FA: true,
          tempToken,
          message: 'Ingresa el código 2FA'
        });
      }

      // Resetear intentos fallidos y actualizar último login
      await admin.resetFailedAttempts(ipAddress);
      await AuditService.logLoginSuccess(admin, ipAddress, userAgent);

      // Generar JWT
      const token = jwt.sign(
        { 
          adminId: admin._id, 
          username: admin.username,
          role: admin.role 
        },
        JWT_SECRET,
        { expiresIn: JWT_EXPIRES_IN }
      );

      console.log(`[AUTH] Login successful for ${username}`);

      res.json({
        success: true,
        token,
        admin: admin.toSecureJSON(),
        message: 'Login exitoso'
      });

    } catch (error) {
      console.error('[AUTH] Error en login:', error);
      res.status(500).json({ 
        success: false, 
        message: 'Error en autenticación',
        error: error.message 
      });
    }
  }

  /**
   * Habilitar autenticación 2FA
   */
  static async enable2FA(req, res) {
    try {
      const adminId = req.admin.adminId;
      const ipAddress = getClientIp(req);
      const userAgent = req.headers['user-agent'];

      const admin = await Admin.findById(adminId);
      if (!admin) {
        return res.status(404).json({ success: false, message: 'Admin no encontrado' });
      }

      // Generar secreto 2FA
      const secret = speakeasy.generateSecret({
        name: `LiveChat Admin (${admin.username})`,
        issuer: 'LiveChat'
      });

      // Guardar secreto (temporalmente, se confirmará después)
      admin.secret2FA = secret.base32;
      await admin.save();

      // Generar código QR
      const qrCodeUrl = await QRCode.toDataURL(secret.otpauth_url);

      await AuditService.log({
        adminId: admin._id,
        adminUsername: admin.username,
        action: '2FA_ENABLED',
        ipAddress,
        userAgent,
        status: 'SUCCESS'
      });

      res.json({
        success: true,
        secret: secret.base32,
        qrCode: qrCodeUrl,
        message: 'Escanea el código QR con tu app de autenticación'
      });

    } catch (error) {
      console.error('[AUTH] Error al habilitar 2FA:', error);
      res.status(500).json({ 
        success: false, 
        message: 'Error al habilitar 2FA',
        error: error.message 
      });
    }
  }

  /**
   * Verificar código 2FA
   */
  static async verify2FA(req, res) {
    try {
      const { tempToken, code } = req.body;
      const ipAddress = getClientIp(req);
      const userAgent = req.headers['user-agent'];

      if (!tempToken || !code) {
        return res.status(400).json({ 
          success: false, 
          message: 'Token y código requeridos' 
        });
      }

      // Verificar token temporal
      let decoded;
      try {
        decoded = jwt.verify(tempToken, JWT_SECRET);
      } catch (error) {
        return res.status(401).json({ 
          success: false, 
          message: 'Token inválido o expirado' 
        });
      }

      if (!decoded.temp) {
        return res.status(401).json({ 
          success: false, 
          message: 'Token inválido' 
        });
      }

      const admin = await Admin.findById(decoded.adminId);
      if (!admin) {
        return res.status(404).json({ success: false, message: 'Admin no encontrado' });
      }

      // Verificar código 2FA
      const verified = speakeasy.totp.verify({
        secret: admin.secret2FA,
        encoding: 'base32',
        token: code,
        window: 2 // Permite 2 códigos antes y después (60 segundos de margen)
      });

      if (!verified) {
        await AuditService.log2FAFailure(admin, ipAddress, userAgent);
        return res.status(401).json({ 
          success: false, 
          message: 'Código 2FA inválido' 
        });
      }

      // Habilitar 2FA si aún no está habilitado
      if (!admin.isEnabled2FA) {
        admin.isEnabled2FA = true;
        await admin.save();
      }

      // Resetear intentos y actualizar login
      await admin.resetFailedAttempts(ipAddress);
      await AuditService.log2FASuccess(admin, ipAddress, userAgent);

      // Generar JWT final
      const token = jwt.sign(
        { 
          adminId: admin._id, 
          username: admin.username,
          role: admin.role 
        },
        JWT_SECRET,
        { expiresIn: JWT_EXPIRES_IN }
      );

      console.log(`[AUTH] 2FA verified for ${admin.username}`);

      res.json({
        success: true,
        token,
        admin: admin.toSecureJSON(),
        message: 'Autenticación 2FA exitosa'
      });

    } catch (error) {
      console.error('[AUTH] Error en verify2FA:', error);
      res.status(500).json({ 
        success: false, 
        message: 'Error al verificar 2FA',
        error: error.message 
      });
    }
  }

  /**
   * Middleware para verificar JWT
   */
  static async verifyToken(req, res, next) {
    try {
      const token = req.headers.authorization?.replace('Bearer ', '');

      if (!token) {
        return res.status(401).json({ 
          success: false, 
          message: 'Token no proporcionado' 
        });
      }

      const decoded = jwt.verify(token, JWT_SECRET);
      
      // Verificar que no sea un token temporal
      if (decoded.temp) {
        return res.status(401).json({ 
          success: false, 
          message: 'Token temporal, completa 2FA' 
        });
      }

      // Verificar que el admin existe y está activo
      const admin = await Admin.findById(decoded.adminId);
      if (!admin || !admin.isActive) {
        return res.status(401).json({ 
          success: false, 
          message: 'Administrador no válido' 
        });
      }

      req.admin = decoded;
      next();

    } catch (error) {
      if (error.name === 'JsonWebTokenError') {
        return res.status(401).json({ 
          success: false, 
          message: 'Token inválido' 
        });
      }
      if (error.name === 'TokenExpiredError') {
        return res.status(401).json({ 
          success: false, 
          message: 'Token expirado' 
        });
      }
      res.status(500).json({ 
        success: false, 
        message: 'Error al verificar token',
        error: error.message 
      });
    }
  }

  /**
   * Confirmar y activar 2FA después de escanear QR
   */
  static async confirm2FA(req, res) {
    try {
      const { code } = req.body;
      const adminId = req.admin.adminId;
      const ipAddress = getClientIp(req);
      const userAgent = req.headers['user-agent'];

      if (!code) {
        return res.status(400).json({ 
          success: false, 
          message: 'Código requerido' 
        });
      }

      const admin = await Admin.findById(adminId);
      if (!admin) {
        return res.status(404).json({ success: false, message: 'Admin no encontrado' });
      }

      if (!admin.secret2FA) {
        return res.status(400).json({ 
          success: false, 
          message: 'Primero debes habilitar 2FA' 
        });
      }

      // Verificar código 2FA
      const verified = speakeasy.totp.verify({
        secret: admin.secret2FA,
        encoding: 'base32',
        token: code,
        window: 2
      });

      if (!verified) {
        await AuditService.log({
          adminId: admin._id,
          adminUsername: admin.username,
          action: '2FA_CONFIRMATION_FAILED',
          status: 'FAILURE',
          ipAddress,
          userAgent
        });
        
        return res.status(401).json({ 
          success: false, 
          message: 'Código 2FA inválido' 
        });
      }

      // Activar 2FA
      admin.isEnabled2FA = true;
      await admin.save();

      await AuditService.log({
        adminId: admin._id,
        adminUsername: admin.username,
        action: '2FA_CONFIRMED',
        status: 'SUCCESS',
        ipAddress,
        userAgent
      });

      res.json({
        success: true,
        message: '2FA activado exitosamente'
      });

    } catch (error) {
      console.error('[AUTH] Error al confirmar 2FA:', error);
      res.status(500).json({ 
        success: false, 
        message: 'Error al confirmar 2FA',
        error: error.message 
      });
    }
  }

  /**
   * Deshabilitar 2FA
   */
  static async disable2FA(req, res) {
    try {
      const adminId = req.admin.adminId;
      const ipAddress = getClientIp(req);
      const userAgent = req.headers['user-agent'];

      const admin = await Admin.findById(adminId);
      if (!admin) {
        return res.status(404).json({ success: false, message: 'Admin no encontrado' });
      }

      if (!admin.isEnabled2FA) {
        return res.status(400).json({ 
          success: false, 
          message: '2FA ya está deshabilitado' 
        });
      }

      // Deshabilitar 2FA
      admin.isEnabled2FA = false;
      admin.secret2FA = null;
      await admin.save();

      await AuditService.log({
        adminId: admin._id,
        adminUsername: admin.username,
        action: '2FA_DISABLED',
        status: 'SUCCESS',
        ipAddress,
        userAgent
      });

      res.json({
        success: true,
        message: '2FA deshabilitado'
      });

    } catch (error) {
      console.error('[AUTH] Error al deshabilitar 2FA:', error);
      res.status(500).json({ 
        success: false, 
        message: 'Error al deshabilitar 2FA',
        error: error.message 
      });
    }
  }

  /**
   * Obtener perfil del admin autenticado
   */
  static async getProfile(req, res) {
    try {
      const admin = await Admin.findById(req.admin.adminId);
      if (!admin) {
        return res.status(404).json({ success: false, message: 'Admin no encontrado' });
      }

      res.json({
        success: true,
        admin: admin.toSecureJSON()
      });

    } catch (error) {
      console.error('[AUTH] Error al obtener perfil:', error);
      res.status(500).json({ 
        success: false, 
        message: 'Error al obtener perfil',
        error: error.message 
      });
    }
  }

  /**
   * Obtener estadísticas del pool de workers
   */
  static getWorkerPoolStats(req, res) {
    const stats = authWorkerPool.getStats();
    res.json({
      success: true,
      workerPool: stats
    });
  }
}

module.exports = {
  AuthController,
  validateRegister,
  validateLogin,
  authWorkerPool
};
