// Archivo CON vulnerabilidades - Para prueba de detección

/**
 * ADVERTENCIA: Este archivo contiene código vulnerable intencional
 * Solo para pruebas de seguridad del pipeline
 */

// ❌ VULNERABILIDAD 1: SQL Injection
function getUserData(userId) {
  const mysql = require('mysql');
  const connection = mysql.createConnection({
    host: 'localhost',
    user: 'root',
    password: 'admin123',  // ❌ Credenciales en el código
    database: 'users'
  });

  // ❌ CRÍTICO: SQL Injection
  const query = "SELECT * FROM users WHERE id = " + userId;
  connection.query(query, function(error, results) {
    if (error) throw error;
    return results;
  });
}

// ❌ VULNERABILIDAD 2: Command Injection
function executeCommand(userInput) {
  const exec = require('child_process').exec;
  
  // ❌ CRÍTICO: Command Injection sin validación
  exec('ls -la ' + userInput, (error, stdout, stderr) => {
    console.log(stdout);
  });
}

// ❌ VULNERABILIDAD 3: Path Traversal
function readFile(filename) {
  const fs = require('fs');
  
  // ❌ CRÍTICO: Sin validación de ruta
  const content = fs.readFileSync(filename, 'utf8');
  return content;
}

// ❌ VULNERABILIDAD 4: Insecure Deserialization
function deserializeData(data) {
  // ❌ CRÍTICO: eval es extremadamente peligroso
  return eval('(' + data + ')');
}

// ❌ VULNERABILIDAD 5: Hardcoded Secrets
const API_KEYS = {
  AWS_SECRET: 'AKIAIOSFODNN7EXAMPLE',
  DB_PASSWORD: 'super_secret_password_123',
  JWT_SECRET: 'my-secret-key-should-not-be-here',
  API_TOKEN: 'ghp_1234567890abcdefghijklmnop'
};

// ❌ VULNERABILIDAD 6: Weak Cryptography
function hashPassword(password) {
  const crypto = require('crypto');
  
  // ❌ MD5 es inseguro
  return crypto.createHash('md5').update(password).digest('hex');
}

// ❌ VULNERABILIDAD 7: XXE (XML External Entity)
function parseXML(xmlString) {
  const xmldom = require('xmldom');
  
  // ❌ Sin protección contra XXE
  const parser = new xmldom.DOMParser();
  return parser.parseFromString(xmlString);
}

// ❌ VULNERABILIDAD 8: Cross-Site Scripting (XSS)
function displayUserComment(comment) {
  // ❌ Sin sanitización
  document.getElementById('comments').innerHTML = comment;
}

// ❌ VULNERABILIDAD 9: Unvalidated Redirect
function redirect(url) {
  // ❌ Sin validación de URL
  window.location.href = url;
}

// ❌ VULNERABILIDAD 10: Race Condition
let counter = 0;

function incrementCounter() {
  // ❌ No es thread-safe
  const temp = counter;
  counter = temp + 1;
}

// ❌ VULNERABILIDAD 11: Broken Authentication
function login(username, password) {
  // ❌ Sin hash, sin salt, sin rate limiting
  const users = {
    'admin': 'password123',
    'user': 'user456'
  };
  
  return users[username] === password;
}

// ❌ VULNERABILIDAD 12: Insecure Direct Object References (IDOR)
function getUserProfile(req, res) {
  // ❌ Sin verificar que el usuario es propietario
  const userId = req.params.userId;
  const user = getUserFromDB(userId);
  res.json(user);
}

// ❌ VULNERABILIDAD 13: Missing Authentication
app.get('/admin/delete-all-users', (req, res) => {
  // ❌ Sin verificar autenticación
  database.deleteAll('users');
  res.send('All users deleted');
});

// ❌ VULNERABILIDAD 14: Insecure Random
function generateSessionId() {
  // ❌ Math.random() es predecible
  return Math.random().toString(36).substring(2, 15);
}

// ❌ VULNERABILIDAD 15: Sensitive Data Exposure
function logUserInfo(user) {
  console.log('User logged in:', user);  // ❌ Expone todo incluyendo password/token
  logger.info('User: ' + user.email + ', Pass: ' + user.password);
}

module.exports = {
  getUserData,
  executeCommand,
  readFile,
  deserializeData,
  API_KEYS,
  hashPassword,
  parseXML,
  displayUserComment,
  redirect,
  login
};
