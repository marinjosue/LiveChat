// Archivo MIXTO - Seguro + Vulnerable juntos

// ✅ SEGURO: Validación correcta
function validateUserInput(input) {
  if (typeof input !== 'string') return false;
  return input.length > 0 && input.length < 100;
}

// ❌ VULNERABLE: SQL Injection
function getUserByEmail(email) {
  const db = require('database');
  const query = "SELECT * FROM users WHERE email = '" + email + "'";
  return db.execute(query);
}

// ✅ SEGURO: Prepared statement
function getUserByEmailSafe(email) {
  const db = require('database');
  return db.execute("SELECT * FROM users WHERE email = ?", [email]);
}

// ❌ VULNERABLE: XSS
function displayComment(comment) {
  document.getElementById('output').innerHTML = comment;
}

// ✅ SEGURO: Sanitizado
function displayCommentSafe(comment) {
  const escaped = comment.replace(/[<>]/g, c => c === '<' ? '&lt;' : '&gt;');
  document.getElementById('output').textContent = escaped;
}

// ❌ VULNERABLE: Hardcoded API Key
const SECRET_KEY = 'sk_live_1234567890abcdef';

// ✅ SEGURO: Desde variables de entorno
const SAFE_KEY = process.env.API_KEY;

// ❌ VULNERABLE: eval
function parseUserExpression(expr) {
  return eval(expr);
}

// ✅ SEGURO: JSON parse
function parseUserJSON(jsonStr) {
  try {
    return JSON.parse(jsonStr);
  } catch {
    return null;
  }
}

module.exports = {
  validateUserInput,
  getUserByEmail,
  getUserByEmailSafe,
  displayComment,
  displayCommentSafe,
  parseUserExpression,
  parseUserJSON
};
