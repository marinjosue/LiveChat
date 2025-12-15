// Archivo MIXTO - Código seguro e inseguro juntos

/**
 * Módulo de utilidades - Mezcla de código seguro e inseguro
 */

// ✅ SEGURO: Validación adecuada
class SecureValidator {
  static validateEmail(email) {
    if (typeof email !== 'string') return false;
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  }

  static validateUsername(username) {
    if (typeof username !== 'string') return false;
    return /^[a-zA-Z0-9_]{3,20}$/.test(username);
  }
}

// ❌ VULNERABLE: SQL Injection
function getUserProfile(userId) {
  // ❌ SQL Injection sin prepared statements
  const db = require('database');
  const query = "SELECT * FROM users WHERE id = " + userId;
  return db.execute(query);
}

// ✅ SEGURO: Uso correcto de prepared statements
function getUserProfileSafe(userId) {
  const db = require('database');
  const query = "SELECT * FROM users WHERE id = ?";
  return db.execute(query, [userId]);
}

// ❌ VULNERABLE: Hardcoded credentials
const dbConfig = {
  host: 'localhost',
  user: 'admin',
  password: 'MyPassword123!',  // ❌ Credencial visible
  database: 'myapp'
};

// ✅ SEGURO: Uso de variables de entorno
const dbConfigSafe = {
  host: process.env.DB_HOST,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME
};

// ❌ VULNERABLE: XSS - Sin sanitización
function displayComment(userComment) {
  document.getElementById('comment-box').innerHTML = userComment;
}

// ✅ SEGURO: Con sanitización
function displayCommentSafe(userComment) {
  const escapeMap = {
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#x27;'
  };
  
  const sanitized = userComment.replace(/[&<>"']/g, char => escapeMap[char]);
  document.getElementById('comment-box').innerHTML = sanitized;
}

// ❌ VULNERABLE: Weak hashing
function hashPasswordWeak(password) {
  const crypto = require('crypto');
  return crypto.createHash('md5').update(password).digest('hex');
}

// ✅ SEGURO: Strong hashing con bcrypt
function hashPasswordStrong(password) {
  const bcrypt = require('bcrypt');
  return bcrypt.hash(password, 10);
}

// ❌ VULNERABLE: Command Injection
function convertVideo(filename) {
  const exec = require('child_process').exec;
  exec('ffmpeg -i ' + filename + ' output.mp4');
}

// ✅ SEGURO: Usando execFile con array de argumentos
function convertVideoSafe(filename) {
  const execFile = require('child_process').execFile;
  execFile('ffmpeg', ['-i', filename, 'output.mp4']);
}

// ❌ VULNERABLE: Insecure Random
function generateToken() {
  return Math.random().toString(36).substring(2);
}

// ✅ SEGURO: Usando crypto.randomBytes
function generateTokenSafe() {
  const crypto = require('crypto');
  return crypto.randomBytes(32).toString('hex');
}

// ❌ VULNERABLE: No autorización
app.delete('/api/user/:id', (req, res) => {
  // ❌ Sin verificar si el usuario puede borrar
  User.findByIdAndDelete(req.params.id);
  res.send('Deleted');
});

// ✅ SEGURO: Con verificación de autorización
app.delete('/api/user/:id', (req, res) => {
  if (req.user.id !== req.params.id && !req.user.isAdmin) {
    return res.status(403).send('Unauthorized');
  }
  User.findByIdAndDelete(req.params.id);
  res.send('Deleted');
});

// ❌ VULNERABLE: Path Traversal
function readFile(filename) {
  const fs = require('fs');
  return fs.readFileSync(filename);
}

// ✅ SEGURO: Con validación de ruta
function readFileSafe(filename) {
  const fs = require('fs');
  const path = require('path');
  
  const baseDir = '/safe/directory';
  const fullPath = path.resolve(baseDir, filename);
  
  if (!fullPath.startsWith(baseDir)) {
    throw new Error('Invalid path');
  }
  
  return fs.readFileSync(fullPath);
}

// ✅ SEGURO: Logging apropiado
function logActivity(action, user) {
  const timestamp = new Date().toISOString();
  console.log(`[${timestamp}] Action: ${action}, User: ${user.email}`);
}

// ❌ VULNERABLE: Exposición de datos sensibles
function handleLogin(username, password) {
  console.log('User logging in:', { username, password });  // ❌ Expone password
  return authenticateUser(username, password);
}

// ✅ SEGURO: Sin exponer datos sensibles
function handleLoginSafe(username, password) {
  const result = authenticateUser(username, password);
  console.log('User authentication attempt:', { username, success: result });
  return result;
}

module.exports = {
  SecureValidator,
  getUserProfile,
  getUserProfileSafe,
  displayComment,
  displayCommentSafe,
  hashPasswordWeak,
  hashPasswordStrong,
  convertVideo,
  convertVideoSafe,
  generateToken,
  generateTokenSafe,
  readFile,
  readFileSafe,
  logActivity,
  handleLogin,
  handleLoginSafe
};
