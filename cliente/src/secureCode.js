class SafeAuthenticator {
  static async verifyPassword(password, hash) {
    const bcrypt = require('bcrypt');
    return await bcrypt.compare(password, hash);
  }

  static validateEmail(email) {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  }

  static sanitizeInput(input) {
    if (typeof input !== 'string') return '';
    return input.replace(/[<>\"']/g, char => {
      const map = { '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#x27;' };
      return map[char];
    });
  }

  static generateToken() {
    const crypto = require('crypto');
    return crypto.randomBytes(32).toString('hex');
  }
}

module.exports = SafeAuthenticator;
