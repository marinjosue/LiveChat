const mongoose = require('mongoose');

const MessageSchema = new mongoose.Schema({
    pin: { type: String, required: true, index: true },
    sender: { type: String, required: true },
    
    // Texto del mensaje (encriptado en reposo)
    text: { type: String },
    
    // Indica si el mensaje está encriptado
    encrypted: { type: Boolean, default: false },
    
    // Metadata de encriptación
    encryptionMetadata: {
        iv: String,
        authTag: String,
        salt: String,
        algorithm: String
    },
    
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
        height: Number,
        // Archivo encriptado
        encrypted: Boolean,
        encryptionMetadata: {
            iv: String,
            authTag: String,
            salt: String
        }
    },
    
    // Hash de integridad del mensaje
    integrityHash: { type: String },
    
    // Verificación de seguridad para archivos
    securityCheck: {
        steganographyAnalyzed: { type: Boolean, default: false },
        isSuspicious: { type: Boolean, default: false },
        suspiciousReasons: [String],
        analysisTimestamp: Date
    },
    
    timestamp: { type: Date, default: Date.now, index: true }
});

// Índices compuestos para optimización
MessageSchema.index({ pin: 1, timestamp: -1 });
MessageSchema.index({ pin: 1, messageType: 1 });

// Método para verificar integridad
MessageSchema.methods.verifyIntegrity = function() {
    const crypto = require('crypto');
    
    const dataString = JSON.stringify({
        pin: this.pin,
        sender: this.sender,
        text: this.text,
        messageType: this.messageType,
        timestamp: this.timestamp
    });
    
    const calculatedHash = crypto
        .createHash('sha256')
        .update(dataString)
        .digest('hex');
    
    return calculatedHash === this.integrityHash;
};

// Pre-save hook para generar hash de integridad
MessageSchema.pre('save', function(next) {
    if (this.isNew && !this.integrityHash) {
        const crypto = require('crypto');
        
        const dataString = JSON.stringify({
            pin: this.pin,
            sender: this.sender,
            text: this.text,
            messageType: this.messageType,
            timestamp: this.timestamp
        });
        
        this.integrityHash = crypto
            .createHash('sha256')
            .update(dataString)
            .digest('hex');
    }
    next();
});

module.exports = mongoose.model('Message', MessageSchema);
