// Archivo VULNERABLE - Con vulnerabilidades claras detectables

// ❌ CWE-89: SQL Injection
function getUserById(userId) {
  const db = require('database');
  const query = "SELECT * FROM users WHERE id = " + userId;
  return db.execute(query);
}

// ❌ CWE-79: XSS - Sin sanitizar
function displayUserComment(comment) {
  document.getElementById('comments').innerHTML = comment;
}

// ❌ CWE-78: Command Injection
function convertFile(filename) {
  const exec = require('child_process').exec;
  exec('convert ' + filename + ' output.jpg');
}

// ❌ CWE-434: Path Traversal - Sin validación
function readUserFile(filepath) {
  const fs = require('fs');
  return fs.readFileSync(filepath, 'utf8');
}

// ❌ CWE-798: Hardcoded Credentials
const API_KEY = 'sk-1234567890abcdefghijklmnop';
const DB_PASSWORD = 'MySecretPassword123';

// ❌ CWE-327: Weak Cryptography (MD5)
function hashPassword(password) {
  const crypto = require('crypto');
  return crypto.createHash('md5').update(password).digest('hex');
}

// ❌ CWE-95: Code Injection con eval
function processUserCode(userInput) {
  return eval(userInput);
}

// ❌ Missing Authentication
app.get('/admin/delete-all', (req, res) => {
  database.deleteAll('users');
  res.send('All deleted');
});

module.exports = {
  getUserById,
  displayUserComment,
  convertFile,
  readUserFile,
  hashPassword,
  processUserCode
};
