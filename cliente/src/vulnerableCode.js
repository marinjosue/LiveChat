// Archivo VULNERABLE - Código con vulnerabilidades claras

// ❌ CRÍTICO: SQL Injection
function getUserById(userId) {
  const db = require('database');
  const query = "SELECT * FROM users WHERE id = " + userId;
  return db.execute(query);
}

// ❌ CRÍTICO: XSS - Sin sanitizar
function displayUserComment(userComment) {
  document.getElementById('comments').innerHTML = userComment;
}

// ❌ CRÍTICO: Command Injection
function convertFile(filename) {
  const exec = require('child_process').exec;
  exec('convert ' + filename + ' output.jpg');
}

// ❌ CRÍTICO: Credenciales hardcodeadas
const API_KEY = 'sk-1234567890abcdefghijklmnop';
const DB_PASSWORD = 'MySecretPassword123';

// ❌ CRÍTICO: Weak hashing (MD5)
function hashPassword(password) {
  const crypto = require('crypto');
  return crypto.createHash('md5').update(password).digest('hex');
}

// ❌ CRÍTICO: eval es peligroso
function processData(userInput) {
  return eval(userInput);
}

// ❌ CRÍTICO: Sin validación de ruta
function readUserFile(filepath) {
  const fs = require('fs');
  return fs.readFileSync(filepath, 'utf8');
}

// ❌ CRÍTICO: Predecible random
function generateSessionId() {
  return Math.random().toString(36).substring(2);
}

// ❌ CRÍTICO: Sin autenticación
app.get('/admin/delete', (req, res) => {
  database.deleteAll();
  res.send('Deleted all');
});

module.exports = {
  getUserById,
  displayUserComment,
  convertFile,
  hashPassword,
  processData,
  readUserFile,
  generateSessionId
};
