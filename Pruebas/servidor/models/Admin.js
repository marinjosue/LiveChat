const mongoose = require('mongoose');
const bcrypt = require('bcrypt');

const adminSchema = new mongoose.Schema({
  username: {
    type: String,
    required: true,
    unique: true,
    trim: true,
    minlength: 3,
    maxlength: 50
  },
  passwordHash: {
    type: String,
    required: true
  },
  email: {
    type: String,
    required: true,
    unique: true,
    trim: true,
    lowercase: true
  },
  // Autenticación 2FA
  secret2FA: {
    type: String,
    default: null
  },
  isEnabled2FA: {
    type: Boolean,
    default: false
  },
  // Control de intentos fallidos (protección contra fuerza bruta)
  failedAttempts: {
    type: Number,
    default: 0
  },
  lockUntil: {
    type: Date,
    default: null
  },
  // Metadata de seguridad
  lastLogin: {
    type: Date,
    default: null
  },
  lastLoginIp: {
    type: String,
    default: null
  },
  createdAt: {
    type: Date,
    default: Date.now
  },
  updatedAt: {
    type: Date,
    default: Date.now
  },
  // Roles y permisos
  role: {
    type: String,
    enum: ['superadmin', 'admin', 'moderator'],
    default: 'admin'
  },
  isActive: {
    type: Boolean,
    default: true
  }
});

// Índice adicional solo para lockUntil (username y email ya tienen índices por unique)
adminSchema.index({ lockUntil: 1 });

// Virtual para verificar si la cuenta está bloqueada
adminSchema.virtual('isLocked').get(function() {
  return !!(this.lockUntil && this.lockUntil > Date.now());
});

// Método estático para crear hash de contraseña
adminSchema.statics.hashPassword = async function(password) {
  const SALT_ROUNDS = 12;
  return await bcrypt.hash(password, SALT_ROUNDS);
};

// Método de instancia para comparar contraseñas
adminSchema.methods.comparePassword = async function(candidatePassword) {
  return await bcrypt.compare(candidatePassword, this.passwordHash);
};

// Método para incrementar intentos fallidos
adminSchema.methods.incrementFailedAttempts = async function() {
  const MAX_ATTEMPTS = 5;
  const LOCK_TIME = 30 * 60 * 1000; // 30 minutos

  // Si ya está bloqueado y el tiempo no ha expirado, no hacer nada
  if (this.lockUntil && this.lockUntil > Date.now()) {
    return;
  }

  // Si el tiempo de bloqueo ha expirado, resetear intentos
  if (this.lockUntil && this.lockUntil <= Date.now()) {
    this.failedAttempts = 1;
    this.lockUntil = null;
  } else {
    this.failedAttempts += 1;
  }

  // Si se alcanza el máximo de intentos, bloquear la cuenta
  if (this.failedAttempts >= MAX_ATTEMPTS) {
    this.lockUntil = new Date(Date.now() + LOCK_TIME);
  }

  await this.save();
};

// Método para resetear intentos fallidos tras login exitoso
adminSchema.methods.resetFailedAttempts = async function(ip) {
  this.failedAttempts = 0;
  this.lockUntil = null;
  this.lastLogin = new Date();
  this.lastLoginIp = ip;
  await this.save();
};

// Middleware pre-save para actualizar updatedAt
adminSchema.pre('save', function(next) {
  this.updatedAt = new Date();
  next();
});

// Método para generar respuesta segura (no exponer datos sensibles)
adminSchema.methods.toSecureJSON = function() {
  return {
    id: this._id,
    username: this.username,
    email: this.email,
    role: this.role,
    isEnabled2FA: this.isEnabled2FA,
    lastLogin: this.lastLogin,
    isActive: this.isActive,
    createdAt: this.createdAt
  };
};

module.exports = mongoose.model('Admin', adminSchema);
