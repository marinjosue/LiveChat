// Archivo SEGURO - Sin vulnerabilidades

/**
 * Módulo de validación y autenticación segura
 */

// ✅ SEGURO: Hash con bcrypt
async function hashPasswordSafely(password) {
  const bcrypt = require('bcrypt');
  return await bcrypt.hash(password, 10);
}

// ✅ SEGURO: Validación de email
function validateEmailSafely(email) {
  const regex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return regex.test(email);
}

// ✅ SEGURO: Sanitización de entrada
function sanitizeInput(input) {
  if (typeof input !== 'string') return '';
  return input.replace(/[<>"']/g, char => {
    const map = { '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#x27;' };
    return map[char];
  });
}

// ✅ SEGURO: Token aleatorio
function generateRandomToken() {
  const crypto = require('crypto');
  return crypto.randomBytes(32).toString('hex');
}

// ✅ SEGURO: Prepared statement
function getUserByIdSafely(userId) {
  const db = require('database');
  return db.execute("SELECT * FROM users WHERE id = ?", [userId]);
}

// ✅ SEGURO: Usando textContent en lugar de innerHTML
function displayMessageSafely(message) {
  const element = document.getElementById('output');
  element.textContent = message;
}

module.exports = {
  hashPasswordSafely,
  validateEmailSafely,
  sanitizeInput,
  generateRandomToken,
  getUserByIdSafely,
  displayMessageSafely
};
