const mongoose = require('mongoose');

const MessageSchema = new mongoose.Schema({
    pin: { type: String, required: true },
    sender: { type: String, required: true },
    text: { type: String, required: true },
    timestamp: { type: Date, default: Date.now }
});

module.exports = mongoose.model('Message', MessageSchema);
