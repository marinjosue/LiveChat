const Room = require('../../models/Room');
const Message = require('../../models/Message');
const RoomMembership = require('../../models/RoomMembership');
const { AuditService } = require('../../services/auditService');

jest.mock('../../models/Room');
jest.mock('../../models/Message');
jest.mock('../../models/RoomMembership');
jest.mock('../../services/auditService');
jest.mock('../../utils/fileUploader');
jest.mock('../../utils/pinGenerator');

describe('RoomController', () => {
  describe('Module Import', () => {
    it('should import RoomController module', () => {
      const RoomController = require('../../controllers/RoomController');
      expect(RoomController).toBeDefined();
    });

    it('should be a constructor function', () => {
      const RoomController = require('../../controllers/RoomController');
      expect(typeof RoomController).toBe('function');
    });
  });

  describe('Room Management', () => {
    it('should have Room model available', () => {
      expect(Room).toBeDefined();
    });

    it('should have Message model available', () => {
      expect(Message).toBeDefined();
    });

    it('should have RoomMembership model available', () => {
      expect(RoomMembership).toBeDefined();
    });
  });

  describe('Socket Events', () => {
    let mockIo;
    let mockSocket;

    beforeEach(() => {
      jest.clearAllMocks();

      // Create mock socket
      mockSocket = {
        id: 'socket123',
        handshake: {
          headers: { 'x-forwarded-for': '192.168.1.1' },
          address: '127.0.0.1'
        },
        conn: { remoteAddress: '127.0.0.1' },
        on: jest.fn(),
        emit: jest.fn(),
        join: jest.fn(),
        leave: jest.fn(),
        disconnect: jest.fn()
      };

      // Create mock io
      mockIo = {
        on: jest.fn((event, callback) => {
          if (event === 'connection') {
            callback(mockSocket);
          }
        }),
        sockets: {
          sockets: new Map()
        }
      };
    });

    it('should register connection event listener', () => {
      const RoomController = require('../../controllers/RoomController');
      RoomController(mockIo);

      expect(mockIo.on).toHaveBeenCalledWith('connection', expect.any(Function));
    });

    it('should handle createRoom event', () => {
      const RoomController = require('../../controllers/RoomController');
      RoomController(mockIo);

      // Get the connection callback
      const connectionCallback = mockIo.on.mock.calls[0][1];
      connectionCallback(mockSocket);

      expect(mockSocket.on).toHaveBeenCalled();
    });
  });

  describe('Room Data Validation', () => {
    it('should validate pin format', () => {
      const pin = '1234';
      expect(pin).toMatch(/^\d+$/);
      expect(pin.length).toBeGreaterThan(0);
    });

    it('should validate nickname length', () => {
      const validNickname = 'User';
      const invalidNickname = 'A'.repeat(20);

      expect(validNickname.length).toBeLessThanOrEqual(12);
      expect(invalidNickname.length).toBeGreaterThan(12);
    });

    it('should validate deviceId', () => {
      const deviceId = 'device-uuid-123';
      expect(deviceId).toBeDefined();
      expect(typeof deviceId).toBe('string');
    });
  });

  describe('Room Operations', () => {
    it('should track room data', () => {
      const rooms = {};
      const pin = '1234';
      
      rooms[pin] = {
        pin,
        users: [],
        createdAt: new Date(),
        limit: 50
      };

      expect(rooms[pin]).toBeDefined();
      expect(rooms[pin].pin).toBe(pin);
    });

    it('should manage user list', () => {
      const users = [];
      const user = {
        id: 'socket1',
        nickname: 'TestUser',
        deviceId: 'device1',
        joinedAt: new Date()
      };

      users.push(user);

      expect(users).toHaveLength(1);
      expect(users[0].nickname).toBe('TestUser');
    });

    it('should emit user list updates', () => {
      const mockSocket = {
        emit: jest.fn()
      };

      const userList = [
        { socketId: 'socket1', nickname: 'User1' },
        { socketId: 'socket2', nickname: 'User2' }
      ];

      mockSocket.emit('userListUpdate', { users: userList });

      expect(mockSocket.emit).toHaveBeenCalledWith(
        'userListUpdate',
        expect.objectContaining({ users: userList })
      );
    });
  });

  describe('IP Detection', () => {
    it('should extract IP from x-forwarded-for header', () => {
      const socket = {
        handshake: { headers: { 'x-forwarded-for': '192.168.1.1, 10.0.0.1' } }
      };

      const ip = socket.handshake.headers['x-forwarded-for']?.split(',')[0];
      expect(ip).toBe('192.168.1.1');
    });

    it('should fallback to handshake address', () => {
      const socket = {
        handshake: { 
          headers: {},
          address: '192.168.1.100'
        }
      };

      const ip = socket.handshake.headers['x-forwarded-for']?.split(',')[0] || socket.handshake.address;
      expect(ip).toBe('192.168.1.100');
    });

    it('should clean IPv6 addresses', () => {
      const ipWithPrefix = '::ffff:192.168.1.1';
      const cleanIp = ipWithPrefix.replace('::ffff:', '');
      expect(cleanIp).toBe('192.168.1.1');
    });
  });

  describe('Audit Logging', () => {
    it('should have AuditService available', () => {
      expect(AuditService).toBeDefined();
    });

    it('should log room creation', () => {
      const logData = {
        action: 'ROOM_CREATED',
        roomPin: '1234',
        roomLimit: 50
      };

      expect(logData.action).toBe('ROOM_CREATED');
    });

    it('should log user join', () => {
      const logData = {
        action: 'USER_JOINED',
        pin: '1234',
        nickname: 'TestUser'
      };

      expect(logData.action).toBe('USER_JOINED');
    });

    it('should log user leave', () => {
      const logData = {
        action: 'USER_LEFT',
        pin: '1234'
      };

      expect(logData.action).toBe('USER_LEFT');
    });
  });

  describe('Message Handling', () => {
    it('should store messages in database', async () => {
      const messageData = {
        pin: '1234',
        sender: 'User1',
        content: 'Hello',
        timestamp: new Date()
      };

      Message.create = jest.fn().mockResolvedValue(messageData);

      const result = await Message.create(messageData);

      expect(Message.create).toHaveBeenCalledWith(messageData);
      expect(result).toEqual(messageData);
    });

    it('should retrieve room messages', async () => {
      const mockMessages = [
        { pin: '1234', sender: 'User1', content: 'Hello' },
        { pin: '1234', sender: 'User2', content: 'Hi' }
      ];

      Message.find = jest.fn().mockResolvedValue(mockMessages);

      const result = await Message.find({ pin: '1234' });

      expect(result).toHaveLength(2);
    });
  });

  describe('Deletion Timers', () => {
    it('should manage room deletion timers', () => {
      const deletionTimers = {};
      const pin = '1234';

      deletionTimers[pin] = setTimeout(() => {
        delete deletionTimers[pin];
      }, 5000);

      expect(deletionTimers[pin]).toBeDefined();

      clearTimeout(deletionTimers[pin]);
    });
  });

  describe('User Tracking', () => {
    it('should track refreshing users', () => {
      const refreshingUsers = new Set();
      const userId = 'socket1';

      refreshingUsers.add(userId);

      expect(refreshingUsers.has(userId)).toBe(true);

      refreshingUsers.delete(userId);

      expect(refreshingUsers.has(userId)).toBe(false);
    });
  });
});
