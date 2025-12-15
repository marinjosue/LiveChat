// Archivo SEGURO - Sin vulnerabilidades

/**
 * Módulo de validación y autenticación segura
 */

class SafeAuthenticator {
  // ✅ Contraseña hasheada con bcrypt
  static async verifyPassword(password, hash) {
    const bcrypt = require('bcrypt');
    return await bcrypt.compare(password, hash);
  }

  // ✅ Validación segura de email
  static validateEmail(email) {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  }

  // ✅ Sanitización de entrada
  static sanitizeInput(input) {
    if (typeof input !== 'string') return '';
    return input.replace(/[<>\"']/g, char => {
      const map = { '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#x27;' };
      return map[char];
    });
  }

  // ✅ Token seguro
  static generateToken() {
    const crypto = require('crypto');
    return crypto.randomBytes(32).toString('hex');
  }
}

module.exports = SafeAuthenticator;
