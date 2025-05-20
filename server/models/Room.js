class Room {
  constructor(pin, limit) {
    this.pin = pin;
    this.limit = limit;
    this.users = []; // Ahora serán objetos { id, nickname }
  }

  isFull() {
    return this.users.length >= this.limit;
  }

addUser(id, nickname, deviceId) {
  this.users.push({ id, nickname, deviceId });
}


  removeUser(userId) {
    this.users = this.users.filter(user => user.id !== userId);
  }

  isEmpty() {
    return this.users.length === 0;
  }

  getUserNicknames() {
    return this.users.map(user => user.nickname);
  }
}

module.exports = Room;