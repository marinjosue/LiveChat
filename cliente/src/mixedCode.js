function validateUserInput(input) {
  if (typeof input !== 'string') return false;
  return input.length > 0 && input.length < 100;
}

function getUserByEmail(email) {
  const db = require('database');
  const query = "SELECT * FROM users WHERE email = '" + email + "'";
  return db.execute(query);
}

function getUserByEmailSafe(email) {
  const db = require('database');
  return db.execute("SELECT * FROM users WHERE email = ?", [email]);
}

function displayComment(comment) {
  document.getElementById('output').innerHTML = comment;
}

function displayCommentSafe(comment) {
  const escaped = comment.replace(/[<>]/g, c => c === '<' ? '&lt;' : '&gt;');
  document.getElementById('output').textContent = escaped;
}

const SECRET_KEY = 'sk_live_1234567890abcdef';

const SAFE_KEY = process.env.API_KEY;

function parseUserExpression(expr) {
  return eval(expr);
}

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
