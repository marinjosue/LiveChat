// Archivo seguro - Sin vulnerabilidades conocidas

/**
 * Módulo de validación segura de usuarios
 * Implementa buenas prácticas de seguridad
 */

class UserValidator {
  /**
   * Valida email usando expresión regular segura
   * @param {string} email - Email a validar
   * @returns {boolean} true si es válido
   */
  static validateEmail(email) {
    if (typeof email !== 'string') {
      return false;
    }
    
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email) && email.length <= 254;
  }

  /**
   * Sanitiza strings para prevenir XSS
   * @param {string} input - String a sanitizar
   * @returns {string} String sanitizado
   */
  static sanitizeInput(input) {
    if (typeof input !== 'string') {
      return '';
    }
    
    const escapeMap = {
      '&': '&amp;',
      '<': '&lt;',
      '>': '&gt;',
      '"': '&quot;',
      "'": '&#x27;'
    };
    
    return input.replace(/[&<>"']/g, char => escapeMap[char]);
  }

  /**
   * Valida longitud de password
   * @param {string} password - Password a validar
   * @returns {boolean} true si cumple requisitos
   */
  static validatePassword(password) {
    if (typeof password !== 'string') {
      return false;
    }
    
    return password.length >= 12 && 
           /[A-Z]/.test(password) &&
           /[0-9]/.test(password) &&
           /[!@#$%^&*]/.test(password);
  }

  /**
   * Valida números de teléfono
   * @param {string} phone - Número a validar
   * @returns {boolean} true si es válido
   */
  static validatePhone(phone) {
    if (typeof phone !== 'string') {
      return false;
    }
    
    const phoneRegex = /^\+?[1-9]\d{1,14}$/;
    return phoneRegex.test(phone.replace(/[\s\-()]/g, ''));
  }

  /**
   * Valida URL de manera segura
   * @param {string} url - URL a validar
   * @returns {boolean} true si es válida
   */
  static validateURL(url) {
    try {
      const urlObj = new URL(url);
      return ['http:', 'https:'].includes(urlObj.protocol);
    } catch {
      return false;
    }
  }
}

/**
 * Módulo de autenticación segura
 */
class SecureAuth {
  /**
   * Hash de password usando crypto nativo
   * @param {string} password - Password a hashear
   * @param {string} salt - Salt para el hash
   * @returns {Promise<string>} Hash del password
   */
  static async hashPassword(password, salt) {
    const crypto = require('crypto');
    
    return new Promise((resolve, reject) => {
      crypto.pbkdf2(password, salt, 100000, 64, 'sha512', (err, derivedKey) => {
        if (err) reject(err);
        resolve(derivedKey.toString('hex'));
      });
    });
  }

  /**
   * Genera un token seguro
   * @param {number} length - Longitud del token
   * @returns {string} Token aleatorio
   */
  static generateSecureToken(length = 32) {
    const crypto = require('crypto');
    return crypto.randomBytes(length).toString('hex');
  }

  /**
   * Valida token JWT de manera segura
   * @param {string} token - Token a validar
   * @param {string} secret - Secret para verificar
   * @returns {boolean} true si es válido
   */
  static validateJWT(token, secret) {
    try {
      const jwt = require('jsonwebtoken');
      jwt.verify(token, secret, { algorithms: ['HS256'] });
      return true;
    } catch {
      return false;
    }
  }
}

/**
 * Módulo de logging seguro
 */
class SecureLogger {
  /**
   * Registra eventos sanitizando datos sensibles
   * @param {string} event - Tipo de evento
   * @param {object} data - Datos a registrar
   */
  static log(event, data) {
    const sanitized = { ...data };
    
    // Remover datos sensibles
    delete sanitized.password;
    delete sanitized.token;
    delete sanitized.secret;
    
    const timestamp = new Date().toISOString();
    console.log(`[${timestamp}] ${event}:`, sanitized);
  }
}

module.exports = {
  UserValidator,
  SecureAuth,
  SecureLogger
};
