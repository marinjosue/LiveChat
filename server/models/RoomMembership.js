const mongoose = require('mongoose');

/**
 * Modelo para gestionar la pertenencia de usuarios a salas
 * Permite que los usuarios minimicen/desconecten de salas sin perder acceso
 */
const roomMembershipSchema = new mongoose.Schema({
  // Identificación del usuario
  deviceId: {
    type: String,
    required: true,
    index: true
  },
  
  nickname: {
    type: String,
    required: true,
    maxlength: 20
  },
  
  // Identificación de la sala
  roomPin: {
    type: String,
    required: true,
    index: true
  },
  
  // Estado de la pertenencia
  isActive: {
    type: Boolean,
    default: true,
    index: true
  },
  
  // ¿Está actualmente conectado?
  isConnected: {
    type: Boolean,
    default: false,
    index: true
  },
  
  // Metadatos
  joinedAt: {
    type: Date,
    default: Date.now
  },
  
  lastSeenAt: {
    type: Date,
    default: Date.now
  },
  
  ip: {
    type: String,
    required: true
  },
  
  // Solo el admin puede remover permanentemente
  removedBy: {
    type: String,
    default: null // null = no removido, 'admin' = removido por admin
  },
  
  removedAt: {
    type: Date,
    default: null
  }
}, {
  timestamps: true,
  collection: 'room_memberships'
});

// Índices compuestos para consultas eficientes
roomMembershipSchema.index({ deviceId: 1, roomPin: 1 }, { unique: true });
roomMembershipSchema.index({ roomPin: 1, isActive: 1 });
roomMembershipSchema.index({ deviceId: 1, isActive: 1 });

// Métodos del esquema
roomMembershipSchema.methods.disconnect = function() {
  this.isConnected = false;
  this.lastSeenAt = new Date();
  return this.save();
};

roomMembershipSchema.methods.connect = function() {
  this.isConnected = true;
  this.lastSeenAt = new Date();
  return this.save();
};

roomMembershipSchema.methods.removeByAdmin = function() {
  this.isActive = false;
  this.removedBy = 'admin';
  this.removedAt = new Date();
  this.isConnected = false;
  return this.save();
};

// Métodos estáticos
roomMembershipSchema.statics.findUserRooms = function(deviceId) {
  return this.find({ 
    deviceId, 
    isActive: true, 
    removedBy: null 
  }).sort({ lastSeenAt: -1 });
};

roomMembershipSchema.statics.findRoomMembers = function(roomPin) {
  return this.find({ 
    roomPin, 
    isActive: true, 
    removedBy: null 
  }).sort({ joinedAt: 1 });
};

roomMembershipSchema.statics.createOrUpdate = function(deviceId, nickname, roomPin, ip) {
  return this.findOneAndUpdate(
    { deviceId, roomPin },
    {
      nickname,
      ip,
      isActive: true,
      isConnected: true,
      lastSeenAt: new Date(),
      removedBy: null,
      removedAt: null
    },
    { 
      upsert: true, 
      new: true,
      setDefaultsOnInsert: true
    }
  );
};

module.exports = mongoose.model('RoomMembership', roomMembershipSchema);