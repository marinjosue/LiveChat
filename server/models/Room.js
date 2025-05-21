class Room {
  constructor(pin, limit = null) {
    this.pin = pin;
    this.limit = limit ? parseInt(limit) : null;
    this.users = [];
    this.createdAt = new Date();
    this.lastActivity = new Date();
  }

  addUser(id, nickname, deviceId) {
    // Primero verificamos si ya existe un usuario con este deviceId
    const existingUserIndex = this.users.findIndex(u => u.deviceId === deviceId);
    
    // Si existe, lo reemplazamos con el nuevo
    if (existingUserIndex !== -1) {
      this.users[existingUserIndex] = { id, nickname, deviceId, joinedAt: new Date() };
    } else {
      // Si no existe, lo añadimos
      this.users.push({ id, nickname, deviceId, joinedAt: new Date() });
    }
    
    this.updateActivity();
    return this.users.length;
  }

  removeUser(id) {
    const index = this.users.findIndex(u => u.id === id);
    if (index !== -1) {
      this.users.splice(index, 1);
      this.updateActivity();
    }
    return this.users.length;
  }

  removeUserByDeviceId(deviceId) {
    const index = this.users.findIndex(u => u.deviceId === deviceId);
    if (index !== -1) {
      this.users.splice(index, 1);
      this.updateActivity();
    }
    return this.users.length;
  }

  getUser(id) {
    return this.users.find(u => u.id === id);
  }

  getUserByDeviceId(deviceId) {
    return this.users.find(u => u.deviceId === deviceId);
  }

  isEmpty() {
    return this.users.length === 0;
  }

  isFull() {
    if (!this.limit) return false;
    return this.users.length >= this.limit;
  }

  updateActivity() {
    this.lastActivity = new Date();
  }

  getUserCount() {
    return this.users.length;
  }

  // Método para obtener información resumida de la sala
  getRoomInfo() {
    return {
      pin: this.pin,
      userCount: this.users.length,
      limit: this.limit,
      createdAt: this.createdAt,
      lastActivity: this.lastActivity
    };
  }
}

module.exports = Room;