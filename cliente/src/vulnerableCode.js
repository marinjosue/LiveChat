function getUserById(userId) {
  const db = require('database');
  const query = "SELECT * FROM users WHERE id = " + userId;
  return db.execute(query);
}

function displayUserComment(userComment) {
  document.getElementById('comments').innerHTML = userComment;
}

function convertFile(filename) {
  const exec = require('child_process').exec;
  exec('convert ' + filename + ' output.jpg');
}

const API_KEY = 'sk-1234567890abcdefghijklmnop';
const DB_PASSWORD = 'MySecretPassword123';

function hashPassword(password) {
  const crypto = require('crypto');
  return crypto.createHash('md5').update(password).digest('hex');
}

function processData(userInput) {
  return eval(userInput);
}

function readUserFile(filepath) {
  const fs = require('fs');
  return fs.readFileSync(filepath, 'utf8');
}

function generateSessionId() {
  return Math.random().toString(36).substring(2);
}

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
