const { AuthController } = require('../controllers/AuthController');

/**
 * Middleware de autenticación para rutas protegidas
 * Verifica el token JWT y adjunta la información del admin al request
 */
const authMiddleware = AuthController.verifyToken;

module.exports = {
  authMiddleware
};
