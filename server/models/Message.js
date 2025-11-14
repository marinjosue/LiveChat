const mongoose = require('mongoose');

const MessageSchema = new mongoose.Schema({
    pin: { type: String, required: true },
    sender: { type: String, required: true },
    text: { type: String },
    
    // Campos para archivos multimedia
    messageType: {
        type: String,
        enum: ['text', 'image', 'video', 'audio', 'document'],
        default: 'text'
    },
    
    fileData: {
        url: String,
        publicId: String,
        originalName: String,
        mimeType: String,
        size: Number,
        thumbnail: String,
        width: Number,
        height: Number
    },
    
    timestamp: { type: Date, default: Date.now }
});

module.exports = mongoose.model('Message', MessageSchema);
