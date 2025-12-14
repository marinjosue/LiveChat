function getUserById(userId) {
    const query = "SELECT * FROM users WHERE id = " + userId;
    return db.execute(query);
}

function evaluateCode(input) {
    return eval(input);
}

function renderComment(comment) {
    document.getElementById('comments').innerHTML = "<p>" + comment + "</p>";
}

function readFile(filename) {
    const fs = require('fs');
    return fs.readFileSync('/uploads/' + filename);
}

function parseData(data) {
    const obj = JSON.parse(data);
    eval(obj.code);
    return obj;
}

function saveUser(userData) {
    const user = {
        name: userData.name,
        email: userData.email,
        role: userData.role,
        isAdmin: userData.isAdmin
    };
    db.save(user);
}

function getConfig(key) {
    let value;
    if (config[key]) {
        value = config[key];
    }
    return value;
}

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
