const express = require('express');
const { AuthController, validateRegister, validateLogin } = require('../controllers/AuthController');
const { authLimiter } = require('../middleware/security');

const router = express.Router();

/**
 * @route   POST /api/auth/register
 * @desc    Registrar nuevo administrador
 * @access  Public (debería ser restringido en producción)
 */
router.post('/register', 
  authLimiter,
  validateRegister,
  AuthController.register
);

/**
 * @route   POST /api/auth/login
 * @desc    Login de administrador
 * @access  Public
 */
router.post('/login',
  authLimiter,
  validateLogin,
  AuthController.login
);

/**
 * @route   POST /api/auth/verify-2fa
 * @desc    Verificar código 2FA
 * @access  Public (requiere tempToken)
 */
router.post('/verify-2fa',
  authLimiter,
  AuthController.verify2FA
);

/**
 * @route   POST /api/auth/enable-2fa
 * @desc    Habilitar autenticación 2FA
 * @access  Private
 */
router.post('/enable-2fa',
  AuthController.verifyToken,
  AuthController.enable2FA
);

/**
 * @route   POST /api/auth/confirm-2fa
 * @desc    Confirmar y activar 2FA
 * @access  Private
 */
router.post('/confirm-2fa',
  AuthController.verifyToken,
  AuthController.confirm2FA
);

/**
 * @route   POST /api/auth/disable-2fa
 * @desc    Deshabilitar 2FA
 * @access  Private
 */
router.post('/disable-2fa',
  AuthController.verifyToken,
  AuthController.disable2FA
);

/**
 * @route   GET /api/auth/profile
 * @desc    Obtener perfil del administrador
 * @access  Private
 */
router.get('/profile',
  AuthController.verifyToken,
  AuthController.getProfile
);

/**
 * @route   GET /api/auth/worker-stats
 * @desc    Obtener estadísticas del pool de workers
 * @access  Private
 */
router.get('/worker-stats',
  AuthController.verifyToken,
  AuthController.getWorkerPoolStats
);

module.exports = router;
