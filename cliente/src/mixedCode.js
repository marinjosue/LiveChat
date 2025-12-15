// Archivo MIXTO - Código seguro e inseguro

// ✅ SEGURO: Prepared statement
function getUserSafely(userId) {
  const db = require('database');
  return db.execute("SELECT * FROM users WHERE id = ?", [userId]);
}

// ❌ VULNERABLE: SQL Injection
function getUserDangerous(userId) {
  const db = require('database');
  const query = "SELECT * FROM users WHERE id = " + userId;
  return db.execute(query);
}

// ✅ SEGURO: Usando textContent
function displayCommentSafely(comment) {
  document.getElementById('output').textContent = comment;
}

// ❌ VULNERABLE: XSS con innerHTML
function displayCommentDangerous(comment) {
  document.getElementById('output').innerHTML = comment;
}

// ✅ SEGURO: Credentials desde env
const SAFE_API_KEY = process.env.API_KEY;

// ❌ VULNERABLE: Hardcoded password
const UNSAFE_PASSWORD = 'admin123';

// ✅ SEGURO: Strong hashing con bcrypt
function hashPasswordSafe(password) {
  const bcrypt = require('bcrypt');
  return bcrypt.hash(password, 10);
}

// ❌ VULNERABLE: Weak MD5 hashing
function hashPasswordWeak(password) {
  const crypto = require('crypto');
  return crypto.createHash('md5').update(password).digest('hex');
}

// ✅ SEGURO: execFile con array de args
function convertFileSafely(filename) {
  const execFile = require('child_process').execFile;
  execFile('convert', [filename, 'output.jpg']);
}

// ❌ VULNERABLE: Command Injection
function convertFileDangerous(filename) {
  const exec = require('child_process').exec;
  exec('convert ' + filename + ' output.jpg');
}

module.exports = {
  getUserSafely,
  getUserDangerous,
  displayCommentSafely,
  displayCommentDangerous,
  hashPasswordSafe,
  hashPasswordWeak,
  convertFileSafely,
  convertFileDangerous
};
