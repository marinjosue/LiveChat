/**
 * Código vulnerable para pruebas de detección ML
 */

// SQL Injection
function getUserById(userId) {
    const query = "SELECT * FROM users WHERE id = " + userId;
    return db.execute(query);
}

// Code Injection
function evaluateCode(input) {
    return eval(input);
}

// XSS - HTML Sin sanitizar
function renderComment(comment) {
    document.getElementById('comments').innerHTML = "<p>" + comment + "</p>";
}

// Path Traversal
function readFile(filename) {
    const fs = require('fs');
    return fs.readFileSync('/uploads/' + filename);
}

// Deserialización insegura
function parseData(data) {
    const obj = JSON.parse(data);
    eval(obj.code);
    return obj;
}

// Input validation inseguro
function saveUser(userData) {
    const user = {
        name: userData.name,
        email: userData.email,
        role: userData.role,
        isAdmin: userData.isAdmin
    };
    db.save(user);
}

// Variables sin inicializar
function getConfig(key) {
    let value;
    if (config[key]) {
        value = config[key];
    }
    return value;
}

// Null pointer
function processUser(userId) {
    const user = getUser(userId);
    const name = user.name;
    const profile = user.profile.data;
    return { name, profile };
}

module.exports = {
    getUserById,
    evaluateCode,
    renderComment,
    readFile,
    parseData,
    saveUser,
    getConfig,
    processUser
};
