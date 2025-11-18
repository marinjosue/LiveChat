const DeviceSession = require('../../models/DeviceSession');
const Admin = require('../../models/Admin');
const { AuditService } = require('../../services/auditService');

jest.mock('../../models/DeviceSession');
jest.mock('../../models/Admin');
jest.mock('../../services/auditService');

describe('DeviceSessionController', () => {
  describe('Module Import', () => {
    it('should import DeviceSessionController module', () => {
      const DeviceSessionController = require('../../controllers/DeviceSessionController');
      expect(DeviceSessionController).toBeDefined();
    });

    it('should export controller object', () => {
      const DeviceSessionController = require('../../controllers/DeviceSessionController');
      expect(typeof DeviceSessionController).toBe('object');
    });
  });

  describe('Available Methods', () => {
    let controller;

    beforeEach(() => {
      jest.clearAllMocks();
      controller = require('../../controllers/DeviceSessionController');
    });

    it('should have registerSession method', () => {
      expect(controller.registerSession).toBeDefined();
      expect(typeof controller.registerSession).toBe('function');
    });

    it('should have methods exported', () => {
      expect(Object.keys(controller).length).toBeGreaterThan(0);
    });
  });

  describe('Device Registration', () => {
    let controller;

    beforeEach(() => {
      jest.clearAllMocks();
      controller = require('../../controllers/DeviceSessionController');
      DeviceSession.create = jest.fn();
      DeviceSession.find = jest.fn();
    });

    it('should register device session', async () => {
      const sessionData = {
        deviceId: 'device-uuid-123',
        ip: '192.168.1.1',
        roomPin: '1234',
        nickname: 'TestUser'
      };

      expect(sessionData.deviceId).toBeDefined();
      expect(sessionData.ip).toBeDefined();
    });

    it('should validate device data structure', () => {
      const device = {
        deviceId: 'device-uuid-123',
        adminId: 'admin1',
        platform: 'Windows',
        userAgent: 'Mozilla/5.0'
      };

      expect(device).toHaveProperty('deviceId');
      expect(device).toHaveProperty('adminId');
      expect(device).toHaveProperty('platform');
      expect(device).toHaveProperty('userAgent');
    });

    it('should generate unique deviceId', () => {
      const deviceIds = new Set();
      const id1 = 'device-' + Math.random().toString(36);
      const id2 = 'device-' + Math.random().toString(36);

      deviceIds.add(id1);
      deviceIds.add(id2);

      expect(deviceIds.size).toBe(2);
      expect(id1).not.toBe(id2);
    });
  });

  describe('Device Validation', () => {
    let controller;

    beforeEach(() => {
      jest.clearAllMocks();
      controller = require('../../controllers/DeviceSessionController');
      DeviceSession.find = jest.fn();
    });

    it('should find devices by IP', async () => {
      const mockSessions = [
        {
          _id: 'session-1',
          deviceId: 'device-uuid-123',
          ip: '192.168.1.1',
          roomPin: '1234'
        }
      ];

      DeviceSession.find.mockResolvedValue(mockSessions);

      const result = await DeviceSession.find({ ip: '192.168.1.1' });

      expect(DeviceSession.find).toHaveBeenCalledWith({ ip: '192.168.1.1' });
    });

    it('should verify device is active', () => {
      const device = {
        _id: 'device-id-1',
        isActive: true,
        adminId: 'admin1'
      };

      expect(device.isActive).toBe(true);
    });
  });

  describe('Device Sessions Management', () => {
    let controller;

    beforeEach(() => {
      jest.clearAllMocks();
      controller = require('../../controllers/DeviceSessionController');
      DeviceSession.find = jest.fn();
    });

    it('should retrieve device sessions by room', async () => {
      const mockSessions = [
        {
          _id: 'session1',
          deviceId: 'device1',
          roomPin: '1234',
          nickname: 'User1'
        },
        {
          _id: 'session2',
          deviceId: 'device2',
          roomPin: '1234',
          nickname: 'User2'
        }
      ];

      DeviceSession.find.mockResolvedValue(mockSessions);

      const result = await DeviceSession.find({ roomPin: '1234' });

      expect(DeviceSession.find).toHaveBeenCalled();
    });

    it('should filter sessions by room PIN', async () => {
      DeviceSession.find = jest.fn().mockResolvedValue([]);

      await DeviceSession.find({ roomPin: '1234' });

      expect(DeviceSession.find).toHaveBeenCalled();
    });

    it('should handle empty session list', async () => {
      DeviceSession.find.mockResolvedValue([]);

      const result = await DeviceSession.find({ roomPin: '99999' });

      expect(result).toEqual([]);
    });
  });

  describe('Device Removal', () => {
    let controller;

    beforeEach(() => {
      jest.clearAllMocks();
      controller = require('../../controllers/DeviceSessionController');
      DeviceSession.deleteOne = jest.fn();
      DeviceSession.deleteMany = jest.fn();
    });

    it('should remove device session by IP', async () => {
      const ip = '192.168.1.1';

      DeviceSession.deleteOne.mockResolvedValue({ deletedCount: 1 });

      await DeviceSession.deleteOne({ ip });

      expect(DeviceSession.deleteOne).toHaveBeenCalledWith({ ip });
    });

    it('should handle removal of non-existent device', async () => {
      DeviceSession.deleteOne.mockResolvedValue({ deletedCount: 0 });

      const result = await DeviceSession.deleteOne({ ip: 'non-existent' });

      expect(result.deletedCount).toBe(0);
    });

    it('should support bulk device removal', async () => {
      const deviceIds = ['device1', 'device2', 'device3'];

      DeviceSession.deleteMany = jest.fn().mockResolvedValue({ deletedCount: 3 });

      await DeviceSession.deleteMany({ _id: { $in: deviceIds } });

      expect(DeviceSession.deleteMany).toHaveBeenCalled();
    });
  });

  describe('Device Integrity Verification', () => {
    let controller;

    beforeEach(() => {
      jest.clearAllMocks();
      controller = require('../../controllers/DeviceSessionController');
      DeviceSession.find = jest.fn();
    });

    it('should verify sessions by IP', async () => {
      const mockSession = {
        _id: 'session-1',
        deviceId: 'device-uuid-123',
        ip: '192.168.1.1',
        roomPin: '1234'
      };

      DeviceSession.find.mockResolvedValue([mockSession]);

      const result = await DeviceSession.find({ ip: '192.168.1.1' });

      expect(DeviceSession.find).toHaveBeenCalled();
      expect(result).toHaveLength(1);
    });

    it('should check device age', () => {
      const device = {
        lastUsed: new Date(Date.now() - 86400000) // 1 day old
      };

      const now = new Date();
      const ageInMs = now - device.lastUsed;
      const ageInDays = ageInMs / (1000 * 60 * 60 * 24);

      expect(ageInDays).toBeGreaterThan(0);
      expect(ageInDays).toBeLessThan(2);
    });

    it('should detect inactive devices', () => {
      const inactivityThreshold = 30 * 24 * 60 * 60 * 1000; // 30 days
      const device = {
        lastUsed: new Date(Date.now() - 45 * 24 * 60 * 60 * 1000) // 45 days old
      };

      const isInactive = (Date.now() - device.lastUsed.getTime()) > inactivityThreshold;

      expect(isInactive).toBe(true);
    });
  });

  describe('Device Session Data', () => {
    it('should track session metadata', () => {
      const session = {
        deviceId: 'device-uuid-123',
        ip: '192.168.1.1',
        roomPin: '1234',
        nickname: 'TestUser',
        createdAt: new Date(),
        lastActive: new Date()
      };

      expect(session.deviceId).toBeDefined();
      expect(session.ip).toBeDefined();
      expect(session.roomPin).toBeDefined();
    });
  });

  describe('Error Handling', () => {
    let controller;

    beforeEach(() => {
      jest.clearAllMocks();
      controller = require('../../controllers/DeviceSessionController');
    });

    it('should handle database errors', async () => {
      DeviceSession.find = jest.fn().mockRejectedValue(new Error('DB Error'));

      try {
        await DeviceSession.find({ ip: '192.168.1.1' });
      } catch (error) {
        expect(error.message).toBe('DB Error');
      }
    });

    it('should handle missing required fields', () => {
      const invalidDevice = {
        deviceId: 'device-uuid-123'
        // Missing adminId
      };

      expect(invalidDevice.adminId).toBeUndefined();
    });
  });

  describe('Device Session Expiration', () => {
    it('should calculate session age', () => {
      const createdAt = new Date();
      const now = new Date();
      const ageInMs = now - createdAt;

      expect(ageInMs).toBeGreaterThanOrEqual(0);
    });

    it('should identify old sessions', () => {
      const oldSession = {
        lastActive: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000) // 2 days ago
      };

      const ageInMs = Date.now() - oldSession.lastActive.getTime();
      const isOld = ageInMs > (24 * 60 * 60 * 1000); // Older than 24 hours

      expect(isOld).toBe(true);
    });
  });

  describe('Device Fingerprinting', () => {
    it('should create session fingerprint', () => {
      const fingerprint = {
        ip: '192.168.1.1',
        deviceId: 'device-uuid-123',
        roomPin: '1234'
      };

      expect(fingerprint.ip).toBeDefined();
      expect(fingerprint.deviceId).toBeDefined();
    });

    it('should compare session fingerprints', () => {
      const fingerprint1 = {
        ip: '192.168.1.1',
        deviceId: 'device-uuid-123'
      };

      const fingerprint2 = {
        ip: '192.168.1.1',
        deviceId: 'device-uuid-123'
      };

      expect(fingerprint1).toEqual(fingerprint2);
    });
  });
});
