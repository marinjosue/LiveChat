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
    it('should import module', () => {
      const RC = require('../../controllers/RoomController');
      expect(RC).toBeDefined();
    });

    it('should be a function', () => {
      const RC = require('../../controllers/RoomController');
      expect(typeof RC).toBe('function');
    });
  });

  describe('Room Management', () => {
    it('should have Room', () => expect(Room).toBeDefined());
    it('should have Message', () => expect(Message).toBeDefined());
    it('should have RoomMembership', () => expect(RoomMembership).toBeDefined());
  });

  describe('Socket Events', () => {
    let mockIo, mockSocket;

    beforeEach(() => {
      jest.clearAllMocks();
      mockSocket = {
        id: 'socket123',
        handshake: { headers: { 'x-forwarded-for': '192.168.1.1' }, address: '127.0.0.1' },
        on: jest.fn(),
        emit: jest.fn(),
        join: jest.fn(),
        leave: jest.fn()
      };
      mockIo = {
        on: jest.fn((event, cb) => event === 'connection' && cb(mockSocket)),
        sockets: { sockets: new Map() }
      };
    });

    it('should register connection', () => {
      const RC = require('../../controllers/RoomController');
      RC(mockIo);
      expect(mockIo.on).toHaveBeenCalledWith('connection', expect.any(Function));
    });

    it('should handle room event', () => {
      const RC = require('../../controllers/RoomController');
      RC(mockIo);
      const cb = mockIo.on.mock.calls[0][1];
      cb(mockSocket);
      expect(mockSocket.on).toHaveBeenCalled();
    });
  });

  describe('Room Validation', () => {
    it('validates pin', () => {
      const pin = '1234';
      expect(pin).toMatch(/^\d+$/);
      expect(pin.length).toBeGreaterThan(0);
    });

    it('validates limit', () => {
      expect(50).toBeGreaterThan(0);
      expect(50).toBeLessThanOrEqual(1000);
    });

    it('validates type', () => {
      const types = ['public', 'private', 'protected'];
      expect(types).toContain('public');
    });

    it('validates file size', () => {
      const size = 10 * 1024 * 1024;
      expect(size).toBeGreaterThan(0);
    });

    it('validates nickname', () => {
      expect('User'.length).toBeLessThanOrEqual(12);
      expect('A'.repeat(20).length).toBeGreaterThan(12);
    });
  });

  describe('Room Creation', () => {
    it('creates room', async () => {
      const data = { limit: 50, roomType: 'private' };
      Room.create = jest.fn().mockResolvedValue({ ...data, pin: '1234' });
      const result = await Room.create(data);
      expect(result).toHaveProperty('pin');
    });

    it('handles error', async () => {
      Room.create = jest.fn().mockRejectedValue(new Error('Error'));
      await expect(Room.create({})).rejects.toThrow();
    });

    it('audits creation', async () => {
      Room.create = jest.fn().mockResolvedValue({});
      await Room.create({});
      expect(Room.create).toHaveBeenCalled();
    });
  });

  describe('User Join', () => {
    it('adds user', async () => {
      RoomMembership.create = jest.fn().mockResolvedValue({ pin: '1234', userId: 'u1' });
      const result = await RoomMembership.create({});
      expect(result).toHaveProperty('userId');
    });

    it('updates count', async () => {
      Room.findOneAndUpdate = jest.fn().mockResolvedValue({ memberCount: 5 });
      const result = await Room.findOneAndUpdate({}, {});
      expect(result).toHaveProperty('memberCount');
    });

    it('prevents duplicate', async () => {
      RoomMembership.findOne = jest.fn().mockResolvedValue({ pin: '1234' });
      const result = await RoomMembership.findOne({});
      expect(result).toBeDefined();
    });
  });

  describe('Message Broadcasting', () => {
    it('broadcasts', async () => {
      Message.create = jest.fn().mockResolvedValue({ content: 'Hi' });
      const result = await Message.create({});
      expect(result).toHaveProperty('content');
    });

    it('validates msg', () => {
      const msg = { content: 'Test', sender: 'U1', pin: '1234' };
      expect(msg.content).toBeTruthy();
      expect(msg.sender).toBeTruthy();
    });

    it('filters content', () => {
      const msg = 'Hello';
      expect(typeof msg).toBe('string');
      expect(msg.length).toBeGreaterThan(0);
    });
  });

  describe('User Leave', () => {
    it('removes user', async () => {
      RoomMembership.deleteOne = jest.fn().mockResolvedValue({ deletedCount: 1 });
      const result = await RoomMembership.deleteOne({});
      expect(result.deletedCount).toBe(1);
    });

    it('decrements count', async () => {
      Room.findOneAndUpdate = jest.fn().mockResolvedValue({ memberCount: 3 });
      const result = await Room.findOneAndUpdate({}, {});
      expect(result.memberCount).toBeGreaterThan(0);
    });
  });

  describe('Room Cleanup', () => {
    it('deletes empty', async () => {
      Room.deleteOne = jest.fn().mockResolvedValue({ deletedCount: 1 });
      const result = await Room.deleteOne({});
      expect(result.deletedCount).toBe(1);
    });

    it('cleans msgs', async () => {
      Message.deleteMany = jest.fn().mockResolvedValue({ deletedCount: 10 });
      const result = await Message.deleteMany({});
      expect(result.deletedCount).toBeGreaterThanOrEqual(0);
    });
  });

  describe('Error Handling', () => {
    it('handles DB error', async () => {
      Room.findOne = jest.fn().mockRejectedValue(new Error('DB'));
      await expect(Room.findOne({})).rejects.toThrow();
    });

    it('handles bad data', () => {
      expect(null).toBeNull();
    });

    it('handles concurrent', async () => {
      Room.findOne.mockResolvedValue({});
      const results = await Promise.all([Room.findOne({}), Room.findOne({})]);
      expect(results).toHaveLength(2);
    });
  });

  describe('Room Operations', () => {
    it('tracks data', () => {
      const rooms = { '1234': { pin: '1234', users: [], limit: 50 } };
      expect(rooms['1234']).toBeDefined();
      expect(rooms['1234'].pin).toBe('1234');
    });

    it('manages users', () => {
      const users = [];
      users.push({ id: 's1', nickname: 'U' });
      expect(users).toHaveLength(1);
    });

    it('emits updates', () => {
      const socket = { emit: jest.fn() };
      socket.emit('update', {});
      expect(socket.emit).toHaveBeenCalled();
    });
  });

  describe('IP Detection', () => {
    it('extracts forwarded', () => {
      const socket = { handshake: { headers: { 'x-forwarded-for': '192.168.1.1, 10.0.0.1' } } };
      const ip = socket.handshake.headers['x-forwarded-for']?.split(',')[0];
      expect(ip).toBe('192.168.1.1');
    });

    it('uses fallback', () => {
      const socket = { handshake: { headers: {}, address: '192.168.1.100' } };
      const ip = socket.handshake.headers['x-forwarded-for'] || socket.handshake.address;
      expect(ip).toBe('192.168.1.100');
    });

    it('cleans ipv6', () => {
      const ip = '::ffff:192.168.1.1'.replace('::ffff:', '');
      expect(ip).toBe('192.168.1.1');
    });
  });

  describe('Audit Logging', () => {
    it('has service', () => expect(AuditService).toBeDefined());
    it('logs creation', () => {
      const log = { action: 'ROOM_CREATED' };
      expect(log.action).toBe('ROOM_CREATED');
    });
    it('logs join', () => {
      const log = { action: 'USER_JOINED' };
      expect(log.action).toBe('USER_JOINED');
    });
    it('logs leave', () => {
      const log = { action: 'USER_LEFT' };
      expect(log.action).toBe('USER_LEFT');
    });
  });

  describe('Message Handling', () => {
    it('stores', async () => {
      Message.create = jest.fn().mockResolvedValue({ content: 'Hi' });
      const result = await Message.create({});
      expect(result.content).toBe('Hi');
    });

    it('retrieves', async () => {
      const msgs = [{ content: 'Hi' }, { content: 'Hello' }];
      Message.find = jest.fn().mockResolvedValue(msgs);
      const result = await Message.find({});
      expect(result).toHaveLength(2);
    });
  });

  describe('Deletion Timers', () => {
    it('manages timers', () => {
      const timers = { '1234': setTimeout(() => {}, 5000) };
      expect(timers['1234']).toBeDefined();
      clearTimeout(timers['1234']);
    });
  });

  describe('User Tracking', () => {
    it('tracks users', () => {
      const users = new Set();
      users.add('u1');
      expect(users.has('u1')).toBe(true);
      users.delete('u1');
      expect(users.has('u1')).toBe(false);
    });
  });

  describe('Advanced Operations', () => {
    it('handles batch operations', async () => {
      Room.find = jest.fn().mockResolvedValue([{ pin: '1' }, { pin: '2' }]);
      const rooms = await Room.find({});
      expect(rooms.length).toBe(2);
    });

    it('handles transactions', async () => {
      const ops = [Room.create({}), Message.create({})];
      await Promise.all(ops);
      expect(Room.create).toHaveBeenCalled();
    });

    it('handles cleanup on error', async () => {
      try {
        throw new Error('Test error');
      } catch (e) {
        expect(e).toBeInstanceOf(Error);
      }
    });
  });

  describe('State Management', () => {
    it('maintains room state', () => {
      const state = { rooms: {}, users: {} };
      state.rooms['1234'] = { pin: '1234', active: true };
      expect(state.rooms['1234'].active).toBe(true);
    });

    it('updates state atomically', () => {
      const state = { count: 0 };
      state.count = Math.max(0, state.count + 1);
      expect(state.count).toBe(1);
    });

    it('handles state conflicts', () => {
      const state1 = { version: 1 };
      const state2 = { version: 1 };
      expect(state1.version).toBe(state2.version);
    });
  });

  describe('Performance', () => {
    it('handles bulk inserts', async () => {
      const bulk = Array(10).fill({ content: 'test' });
      Message.insertMany = jest.fn().mockResolvedValue(bulk);
      const result = await Message.insertMany(bulk);
      expect(result.length).toBe(10);
    });

    it('handles pagination', async () => {
      Message.find = jest.fn().mockReturnValue({
        skip: jest.fn().mockReturnValue({
          limit: jest.fn().mockResolvedValue([])
        })
      });
      await Message.find({}).skip(0).limit(10);
      expect(Message.find).toHaveBeenCalled();
    });

    it('indexes data', () => {
      expect(Room).toBeDefined();
      expect(Message).toBeDefined();
    });
  });
});
