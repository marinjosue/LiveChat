const Room = require('../../models/Room');

describe('Room Model', () => {
  describe('Constructor', () => {
    it('should create room with pin and limit', () => {
      const room = new Room('1234', 10);
      expect(room.pin).toBe('1234');
      expect(room.limit).toBe(10);
      expect(room.users).toEqual([]);
    });

    it('should create room with default values', () => {
      const room = new Room('5678');
      expect(room.pin).toBe('5678');
      expect(room.limit).toBeNull();
      expect(room.roomType).toBe('text');
    });

    it('should create multimedia room', () => {
      const room = new Room('9999', 5, 'multimedia');
      expect(room.roomType).toBe('multimedia');
      expect(room.multimediaConfig).toBeDefined();
    });

    it('should create room with custom name', () => {
      const room = new Room('1111', 10, 'text', 'My Room');
      expect(room.name).toBe('My Room');
    });

    it('should generate hashed PIN', () => {
      const room = new Room('1234');
      expect(room.hashedPin).toBeDefined();
      expect(room.hashedPin).toHaveLength(64);
    });

    it('should generate encrypted ID', () => {
      const room = new Room('1234');
      expect(room.encryptedId).toBeDefined();
      expect(room.encryptedId).toHaveLength(16);
    });

    it('should set creation timestamp', () => {
      const room = new Room('1234');
      expect(room.createdAt).toBeInstanceOf(Date);
      expect(room.lastActivity).toBeInstanceOf(Date);
    });

    it('should set active status', () => {
      const room = new Room('1234');
      expect(room.isActive).toBe(true);
    });

    it('should accept custom options', () => {
      const options = {
        maxFileSize: 20 * 1024 * 1024,
        createdBy: 'admin123'
      };
      const room = new Room('1234', 10, 'multimedia', null, options);
      expect(room.multimediaConfig.maxFileSize).toBe(20 * 1024 * 1024);
      expect(room.createdBy).toBe('admin123');
    });
  });

  describe('verifyPin', () => {
    it('should verify correct PIN', () => {
      const room = new Room('1234');
      expect(room.verifyPin('1234')).toBe(true);
    });

    it('should reject incorrect PIN', () => {
      const room = new Room('1234');
      expect(room.verifyPin('5678')).toBe(false);
    });

    it('should handle numeric PINs', () => {
      const room = new Room(1234);
      expect(room.verifyPin(1234)).toBe(true);
    });
  });

  describe('isFileTypeAllowed', () => {
    it('should reject files in text rooms', () => {
      const room = new Room('1234', 10, 'text');
      expect(room.isFileTypeAllowed('image/jpeg')).toBe(false);
    });

    it('should allow images in multimedia rooms', () => {
      const room = new Room('1234', 10, 'multimedia');
      expect(room.isFileTypeAllowed('image/jpeg')).toBe(true);
      expect(room.isFileTypeAllowed('image/png')).toBe(true);
    });

    it('should allow documents in multimedia rooms', () => {
      const room = new Room('1234', 10, 'multimedia');
      expect(room.isFileTypeAllowed('application/pdf')).toBe(true);
    });

    it('should allow videos in multimedia rooms', () => {
      const room = new Room('1234', 10, 'multimedia');
      expect(room.isFileTypeAllowed('video/mp4')).toBe(true);
    });

    it('should allow audio in multimedia rooms', () => {
      const room = new Room('1234', 10, 'multimedia');
      expect(room.isFileTypeAllowed('audio/mpeg')).toBe(true);
    });

    it('should reject unlisted file types', () => {
      const room = new Room('1234', 10, 'multimedia');
      expect(room.isFileTypeAllowed('application/x-msdownload')).toBe(false);
    });
  });

  describe('isFileSizeValid', () => {
    it('should accept files within size limit', () => {
      const room = new Room('1234', 10, 'multimedia');
      expect(room.isFileSizeValid(5 * 1024 * 1024)).toBe(true);
    });

    it('should reject files exceeding size limit', () => {
      const room = new Room('1234', 10, 'multimedia');
      expect(room.isFileSizeValid(20 * 1024 * 1024)).toBe(false);
    });

    it('should accept files at exact size limit', () => {
      const room = new Room('1234', 10, 'multimedia');
      expect(room.isFileSizeValid(15 * 1024 * 1024)).toBe(true);
    });

    it('should use custom max file size', () => {
      const options = { maxFileSize: 25 * 1024 * 1024 };
      const room = new Room('1234', 10, 'multimedia', null, options);
      expect(room.isFileSizeValid(20 * 1024 * 1024)).toBe(true);
    });
  });

  describe('addUser', () => {
    it('should add new user', () => {
      const room = new Room('1234', 10);
      const count = room.addUser('socket1', 'User1', 'device1');
      expect(count).toBe(1);
      expect(room.users).toHaveLength(1);
    });

    it('should add multiple users', () => {
      const room = new Room('1234', 10);
      room.addUser('socket1', 'User1', 'device1');
      room.addUser('socket2', 'User2', 'device2');
      expect(room.users).toHaveLength(2);
    });

    it('should replace existing user with same deviceId', () => {
      const room = new Room('1234', 10);
      room.addUser('socket1', 'User1', 'device1');
      room.addUser('socket2', 'User1', 'device1');
      expect(room.users).toHaveLength(1);
      expect(room.users[0].id).toBe('socket2');
    });

    it('should update lastActivity when adding user', (done) => {
      const room = new Room('1234', 10);
      const before = room.lastActivity.getTime();
      setTimeout(() => {
        room.addUser('socket1', 'User1', 'device1');
        expect(room.lastActivity.getTime()).toBeGreaterThanOrEqual(before);
        done();
      }, 10);
    });

    it('should store user with joinedAt timestamp', () => {
      const room = new Room('1234', 10);
      room.addUser('socket1', 'User1', 'device1');
      expect(room.users[0].joinedAt).toBeInstanceOf(Date);
    });
  });

  describe('removeUser', () => {
    it('should remove user by socket id', () => {
      const room = new Room('1234', 10);
      room.addUser('socket1', 'User1', 'device1');
      const count = room.removeUser('socket1');
      expect(count).toBe(0);
      expect(room.users).toHaveLength(0);
    });

    it('should return correct count after removal', () => {
      const room = new Room('1234', 10);
      room.addUser('socket1', 'User1', 'device1');
      room.addUser('socket2', 'User2', 'device2');
      room.removeUser('socket1');
      expect(room.users).toHaveLength(1);
    });

    it('should not error when removing non-existent user', () => {
      const room = new Room('1234', 10);
      room.removeUser('socket999');
      expect(room.users).toHaveLength(0);
    });

    it('should update lastActivity when removing user', (done) => {
      const room = new Room('1234', 10);
      room.addUser('socket1', 'User1', 'device1');
      const before = room.lastActivity.getTime();
      setTimeout(() => {
        room.removeUser('socket1');
        expect(room.lastActivity.getTime()).toBeGreaterThanOrEqual(before);
        done();
      }, 10);
    });
  });

  describe('removeUserByDeviceId', () => {
    it('should remove user by device id', () => {
      const room = new Room('1234', 10);
      room.addUser('socket1', 'User1', 'device1');
      const count = room.removeUserByDeviceId('device1');
      expect(count).toBe(0);
    });

    it('should handle non-existent device id', () => {
      const room = new Room('1234', 10);
      room.addUser('socket1', 'User1', 'device1');
      room.removeUserByDeviceId('device999');
      expect(room.users).toHaveLength(1);
    });
  });

  describe('getUser', () => {
    it('should get user by socket id', () => {
      const room = new Room('1234', 10);
      room.addUser('socket1', 'User1', 'device1');
      const user = room.getUser('socket1');
      expect(user).toBeDefined();
      expect(user.nickname).toBe('User1');
    });

    it('should return undefined for non-existent user', () => {
      const room = new Room('1234', 10);
      const user = room.getUser('socket999');
      expect(user).toBeUndefined();
    });
  });

  describe('getUserByDeviceId', () => {
    it('should get user by device id', () => {
      const room = new Room('1234', 10);
      room.addUser('socket1', 'User1', 'device1');
      const user = room.getUserByDeviceId('device1');
      expect(user).toBeDefined();
      expect(user.nickname).toBe('User1');
    });

    it('should return undefined for non-existent device', () => {
      const room = new Room('1234', 10);
      const user = room.getUserByDeviceId('device999');
      expect(user).toBeUndefined();
    });
  });

  describe('isEmpty', () => {
    it('should return true for empty room', () => {
      const room = new Room('1234', 10);
      expect(room.isEmpty()).toBe(true);
    });

    it('should return false for non-empty room', () => {
      const room = new Room('1234', 10);
      room.addUser('socket1', 'User1', 'device1');
      expect(room.isEmpty()).toBe(false);
    });
  });

  describe('isFull', () => {
    it('should return false when room has no limit', () => {
      const room = new Room('1234');
      room.addUser('socket1', 'User1', 'device1');
      expect(room.isFull()).toBe(false);
    });

    it('should return true when room is at capacity', () => {
      const room = new Room('1234', 2);
      room.addUser('socket1', 'User1', 'device1');
      room.addUser('socket2', 'User2', 'device2');
      expect(room.isFull()).toBe(true);
    });

    it('should return false when room is not full', () => {
      const room = new Room('1234', 5);
      room.addUser('socket1', 'User1', 'device1');
      expect(room.isFull()).toBe(false);
    });
  });

  describe('updateActivity', () => {
    it('should update lastActivity', (done) => {
      const room = new Room('1234');
      const before = room.lastActivity.getTime();
      setTimeout(() => {
        room.updateActivity();
        expect(room.lastActivity.getTime()).toBeGreaterThan(before);
        done();
      }, 10);
    });
  });

  describe('getUserCount', () => {
    it('should return correct user count', () => {
      const room = new Room('1234');
      expect(room.getUserCount()).toBe(0);
      room.addUser('socket1', 'User1', 'device1');
      expect(room.getUserCount()).toBe(1);
      room.addUser('socket2', 'User2', 'device2');
      expect(room.getUserCount()).toBe(2);
    });
  });

  describe('getRoomInfo', () => {
    it('should return complete room info', () => {
      const room = new Room('1234', 10, 'text', 'Test Room');
      const info = room.getRoomInfo();
      expect(info.pin).toBe('1234');
      expect(info.name).toBe('Test Room');
      expect(info.roomType).toBe('text');
      expect(info.limit).toBe(10);
      expect(info).toHaveProperty('encryptedId');
      expect(info).toHaveProperty('createdAt');
      expect(info).toHaveProperty('lastActivity');
      expect(info).toHaveProperty('isActive');
    });

    it('should include multimedia config for multimedia rooms', () => {
      const room = new Room('1234', 10, 'multimedia');
      const info = room.getRoomInfo();
      expect(info.multimediaConfig).toBeDefined();
      expect(info.multimediaConfig.maxFileSize).toBeDefined();
    });

    it('should not include multimedia config for text rooms', () => {
      const room = new Room('1234', 10, 'text');
      const info = room.getRoomInfo();
      expect(info.multimediaConfig).toBeNull();
    });

    it('should show current user count', () => {
      const room = new Room('1234', 10);
      room.addUser('socket1', 'User1', 'device1');
      room.addUser('socket2', 'User2', 'device2');
      const info = room.getRoomInfo();
      expect(info.userCount).toBe(2);
    });
  });

  describe('changeRoomType', () => {
    it('should change from text to multimedia', () => {
      const room = new Room('1234', 10, 'text');
      const result = room.changeRoomType('multimedia');
      expect(result.success).toBe(true);
      expect(room.roomType).toBe('multimedia');
    });

    it('should change from multimedia to text', () => {
      const room = new Room('1234', 10, 'multimedia');
      const result = room.changeRoomType('text');
      expect(result.success).toBe(true);
      expect(room.roomType).toBe('text');
    });

    it('should throw error if room has users', () => {
      const room = new Room('1234', 10, 'text');
      room.addUser('socket1', 'User1', 'device1');
      expect(() => room.changeRoomType('multimedia')).toThrow();
    });

    it('should throw error for invalid room type', () => {
      const room = new Room('1234', 10, 'text');
      expect(() => room.changeRoomType('invalid')).toThrow();
    });

    it('should update lastActivity', (done) => {
      const room = new Room('1234', 10, 'text');
      const before = room.lastActivity.getTime();
      setTimeout(() => {
        room.changeRoomType('multimedia');
        expect(room.lastActivity.getTime()).toBeGreaterThan(before);
        done();
      }, 10);
    });

    it('should record who changed the room type', () => {
      const room = new Room('1234', 10, 'text');
      const result = room.changeRoomType('multimedia', 'admin123');
      expect(result.changedBy).toBe('admin123');
    });
  });

  describe('updateMultimediaConfig', () => {
    it('should update max file size', () => {
      const room = new Room('1234', 10, 'multimedia');
      const result = room.updateMultimediaConfig({ maxFileSize: 25 * 1024 * 1024 });
      expect(result.success).toBe(true);
      expect(room.multimediaConfig.maxFileSize).toBe(25 * 1024 * 1024);
    });

    it('should update allowed file types', () => {
      const room = new Room('1234', 10, 'multimedia');
      const newTypes = ['image/jpeg', 'image/png'];
      room.updateMultimediaConfig({ allowedFileTypes: newTypes });
      expect(room.multimediaConfig.allowedFileTypes).toEqual(newTypes);
    });

    it('should update steganography check setting', () => {
      const room = new Room('1234', 10, 'multimedia');
      room.updateMultimediaConfig({ steganographyCheck: false });
      expect(room.multimediaConfig.steganographyCheck).toBe(false);
    });

    it('should throw error for text rooms', () => {
      const room = new Room('1234', 10, 'text');
      expect(() => room.updateMultimediaConfig({ maxFileSize: 20 * 1024 * 1024 })).toThrow();
    });

    it('should return updated config', () => {
      const room = new Room('1234', 10, 'multimedia');
      const result = room.updateMultimediaConfig({ maxFileSize: 20 * 1024 * 1024 });
      expect(result.config).toBeDefined();
      expect(result.config.maxFileSize).toBe(20 * 1024 * 1024);
    });

    it('should record who updated the config', () => {
      const room = new Room('1234', 10, 'multimedia');
      const result = room.updateMultimediaConfig({ maxFileSize: 20 * 1024 * 1024 }, 'admin123');
      expect(result.updatedBy).toBe('admin123');
    });

    it('should update lastActivity', (done) => {
      const room = new Room('1234', 10, 'multimedia');
      const before = room.lastActivity.getTime();
      setTimeout(() => {
        room.updateMultimediaConfig({ maxFileSize: 20 * 1024 * 1024 });
        expect(room.lastActivity.getTime()).toBeGreaterThan(before);
        done();
      }, 10);
    });
  });

  describe('Edge Cases', () => {
    it('should handle room with zero limit', () => {
      const room = new Room('1234', 0);
      expect(room.limit).toBe(null); // 0 se convierte en null por el operador ||
      expect(room.isFull()).toBe(false); // Sin límite, nunca está llena
    });

    it('should handle very large user limits', () => {
      const room = new Room('1234', 10000);
      expect(room.limit).toBe(10000);
      expect(room.isFull()).toBe(false);
    });

    it('should handle string limits', () => {
      const room = new Room('1234', '10');
      expect(room.limit).toBe(10);
      expect(typeof room.limit).toBe('number');
    });

    it('should generate unique encrypted IDs', () => {
      const room1 = new Room('1234');
      const room2 = new Room('1234');
      expect(room1.encryptedId).not.toBe(room2.encryptedId);
    });

    it('should handle special characters in room name', () => {
      const room = new Room('1234', 10, 'text', 'Sala #1 @ Test!');
      expect(room.name).toBe('Sala #1 @ Test!');
    });
  });
});
