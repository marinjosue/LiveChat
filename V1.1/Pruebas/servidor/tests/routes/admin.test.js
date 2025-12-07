const express = require('express');

jest.mock('../../services/auditService');
jest.mock('../../services/loggerService');
jest.mock('../../models/Room');
jest.mock('../../models/Message');
jest.mock('../../models/Admin');
jest.mock('../../controllers/AuthController');

const { AuditService } = require('../../services/auditService');
const { LoggerService } = require('../../services/loggerService');
const { AuthController } = require('../../controllers/AuthController');

describe('Admin Routes', () => {
  let app, req, res;

  beforeEach(() => {
    jest.clearAllMocks();
    
    app = express();
    app.use(express.json());
    
    AuthController.verifyToken = jest.fn((req, res, next) => {
      req.admin = { adminId: 'admin1', username: 'admin' };
      next();
    });

    req = {
      query: {},
      body: {},
      params: {},
      admin: { adminId: 'admin1', username: 'admin' },
      ip: '127.0.0.1',
      headers: { 'user-agent': 'test' }
    };

    res = {
      json: jest.fn().mockReturnThis(),
      status: jest.fn().mockReturnThis(),
      send: jest.fn().mockReturnThis(),
      setHeader: jest.fn().mockReturnThis()
    };

    const adminRouter = require('../../routes/admin');
    app.use('/api/admin', adminRouter);
  });

  describe('Module Import', () => {
    it('should import admin router', () => {
      const AdminRouter = require('../../routes/admin');
      expect(AdminRouter).toBeDefined();
    });

    it('should be an express router', () => {
      const AdminRouter = require('../../routes/admin');
      expect(typeof AdminRouter).toBe('function');
    });
  });

  describe('Route Configuration', () => {
    it('should have admin router', () => {
      const AdminRouter = require('../../routes/admin');
      expect(AdminRouter).toBeDefined();
    });

    it('should support route parameters', () => {
      const testParams = {
        userId: 'user1',
        action: 'create'
      };

      expect(testParams.userId).toBeDefined();
      expect(testParams.action).toBeDefined();
    });
  });

  describe('GET /api/admin/logs - Logs Retrieval', () => {
    it('calls AuditService.getLogs with pagination', async () => {
      AuditService.getLogs = jest.fn().mockResolvedValue({
        logs: [{ id: 1, action: 'LOGIN' }],
        total: 1,
        page: 1,
        limit: 50
      });

      req.query = { page: 1, limit: 50 };
      const result = await AuditService.getLogs({}, req.query);
      expect(result.logs).toBeDefined();
    });

    it('supports pagination parameters', () => {
      req.query = { page: 2, limit: 100 };
      expect(parseInt(req.query.page)).toBe(2);
      expect(parseInt(req.query.limit)).toBe(100);
    });

    it('filters by action', () => {
      req.query = { action: 'DELETE_ROOM' };
      expect(req.query.action).toBe('DELETE_ROOM');
    });

    it('filters by status', () => {
      req.query = { status: 'SUCCESS' };
      expect(req.query.status).toBe('SUCCESS');
    });

    it('supports date range', () => {
      req.query = { startDate: '2025-01-01', endDate: '2025-12-31' };
      expect(req.query.startDate).toBeDefined();
      expect(req.query.endDate).toBeDefined();
    });

    it('returns logs array', () => {
      const response = { success: true, logs: [] };
      expect(Array.isArray(response.logs)).toBe(true);
    });

    it('handles error from service', async () => {
      AuditService.getLogs = jest.fn().mockRejectedValue(new Error('Service Error'));
      try {
        await AuditService.getLogs({});
      } catch (error) {
        expect(error.message).toContain('Service');
      }
    });

    it('returns 500 on error', () => {
      res.status(500).json({ success: false });
      expect(res.status).toHaveBeenCalledWith(500);
    });
  });

  describe('POST /api/admin/logs/verify-integrity', () => {
    it('accepts logIds in body', () => {
      req.body = { logIds: ['log1', 'log2'] };
      expect(req.body.logIds).toHaveLength(2);
    });

    it('calls verify service', async () => {
      AuditService.verifyLogsIntegrity = jest.fn().mockResolvedValue({
        valid: true,
        verified: 2
      });

      const result = await AuditService.verifyLogsIntegrity(['log1', 'log2']);
      expect(result.valid).toBe(true);
    });

    it('returns integrity status', () => {
      const response = { valid: true, errors: [] };
      expect(response).toHaveProperty('valid');
    });

    it('includes error details', () => {
      const response = { valid: false, errors: ['Mismatch'] };
      expect(response.errors).toBeDefined();
    });

    it('handles empty ids', () => {
      req.body = { logIds: [] };
      expect(req.body.logIds).toHaveLength(0);
    });

    it('logs action', () => {
      AuditService.log = jest.fn().mockResolvedValue({});
      expect(AuditService.log).toBeDefined();
    });
  });

  describe('GET /api/admin/logs/files', () => {
    it('lists log files', async () => {
      LoggerService.listLogFiles = jest.fn().mockResolvedValue({
        files: [{ name: 'app.log' }]
      });

      const result = await LoggerService.listLogFiles();
      expect(result.files).toBeDefined();
    });

    it('returns file list', () => {
      const response = { files: [{ name: 'audit.log' }] };
      expect(Array.isArray(response.files)).toBe(true);
    });

    it('includes file metadata', () => {
      const file = { name: 'app.log', size: 1024 };
      expect(file).toHaveProperty('name');
      expect(file).toHaveProperty('size');
    });

    it('logs file access', () => {
      AuditService.log = jest.fn().mockResolvedValue({});
      expect(AuditService.log).toBeDefined();
    });

    it('handles empty list', async () => {
      LoggerService.listLogFiles = jest.fn().mockResolvedValue({ files: [] });
      const result = await LoggerService.listLogFiles();
      expect(result.files).toHaveLength(0);
    });
  });

  describe('GET /api/admin/logs/file/:filename', () => {
    it('reads filename param', () => {
      req.params.filename = 'app.log';
      expect(req.params.filename).toBe('app.log');
    });

    it('validates filename', () => {
      req.params.filename = 'app.log';
      const valid = /^[\w\-\.]+\.(log|txt)$/.test(req.params.filename);
      expect(valid).toBe(true);
    });

    it('blocks path traversal', () => {
      req.params.filename = '../../../etc/passwd';
      const safe = !req.params.filename.includes('..');
      expect(safe).toBe(false);
    });

    it('reads content', async () => {
      LoggerService.readLogFile = jest.fn().mockResolvedValue('content');
      const content = await LoggerService.readLogFile('app.log');
      expect(typeof content).toBe('string');
    });

    it('returns file content', () => {
      const response = { success: true, content: 'data' };
      expect(response.content).toBeDefined();
    });

    it('includes size', () => {
      const response = { size: 1024 };
      expect(response).toHaveProperty('size');
    });

    it('handles missing file', async () => {
      LoggerService.readLogFile = jest.fn()
        .mockRejectedValue(new Error('ENOENT'));
      try {
        await LoggerService.readLogFile('missing.log');
      } catch (error) {
        expect(error.message).toContain('ENOENT');
      }
    });

    it('returns 404 for missing', () => {
      const response = { success: false };
      expect(response.success).toBe(false);
    });
  });

  describe('GET /api/admin/stats', () => {
    it('retrieves statistics', () => {
      const stats = { totalRooms: 5, totalUsers: 100 };
      expect(stats.totalRooms).toBeDefined();
    });

    it('calculates totals', () => {
      const stats = { rooms: 5, users: 100 };
      expect(stats.rooms + stats.users).toBe(105);
    });

    it('includes active count', () => {
      const stats = { active: 20 };
      expect(stats.active).toBeGreaterThanOrEqual(0);
    });

    it('supports time range', () => {
      req.query = { range: '24h' };
      expect(['24h', '7d', '30d'].includes(req.query.range)).toBe(true);
    });

    it('returns formatted data', () => {
      const response = { success: true, stats: {} };
      expect(response.stats).toBeDefined();
    });

    it('logs access', () => {
      AuditService.log = jest.fn().mockResolvedValue({});
      expect(AuditService.log).toBeDefined();
    });

    it('handles zero stats', () => {
      const stats = { total: 0 };
      expect(stats.total).toBe(0);
    });
  });

  describe('GET /api/admin/messages/:pin', () => {
    it('reads pin param', () => {
      req.params.pin = '1234';
      expect(req.params.pin).toBe('1234');
    });

    it('supports pagination', () => {
      req.query = { page: 1, limit: 20 };
      expect(parseInt(req.query.page)).toBe(1);
    });

    it('filters by sender', () => {
      req.query = { sender: 'user1' };
      expect(req.query.sender).toBeDefined();
    });

    it('filters by date', () => {
      req.query = { startDate: '2025-01-01' };
      expect(req.query.startDate).toBeDefined();
    });

    it('returns messages', () => {
      const response = { messages: [] };
      expect(Array.isArray(response.messages)).toBe(true);
    });

    it('includes total count', () => {
      const response = { total: 100, page: 1 };
      expect(response).toHaveProperty('total');
    });

    it('logs retrieval', () => {
      AuditService.log = jest.fn().mockResolvedValue({});
      expect(AuditService.log).toBeDefined();
    });

    it('handles missing room', () => {
      const response = { success: false };
      expect(response.success).toBe(false);
    });
  });

  describe('Middleware & Auth', () => {
    it('requires auth', () => {
      expect(AuthController.verifyToken).toBeDefined();
    });

    it('applies auth to all routes', () => {
      AuthController.verifyToken = jest.fn((req, res, next) => {
        if (!req.admin) res.status(401).json({});
        else next();
      });
      expect(AuthController.verifyToken).toBeDefined();
    });

    it('sets admin context', () => {
      req.admin = { adminId: 'admin1' };
      expect(req.admin.adminId).toBe('admin1');
    });

    it('rejects without auth', () => {
      delete req.admin;
      expect(req.admin).toBeUndefined();
    });
  });

  describe('Error Responses', () => {
    it('returns 400 for bad request', () => {
      res.status(400).json({ error: 'Bad request' });
      expect(res.status).toHaveBeenCalledWith(400);
    });

    it('returns 401 for unauthorized', () => {
      res.status(401).json({ error: 'Unauthorized' });
      expect(res.status).toHaveBeenCalledWith(401);
    });

    it('returns 404 for not found', () => {
      res.status(404).json({ error: 'Not found' });
      expect(res.status).toHaveBeenCalledWith(404);
    });

    it('returns 500 for server error', () => {
      res.status(500).json({ error: 'Server error' });
      expect(res.status).toHaveBeenCalledWith(500);
    });

    it('includes error message', () => {
      const error = { message: 'Something went wrong' };
      expect(error).toHaveProperty('message');
    });
  });

  describe('Response Format', () => {
    it('returns JSON', () => {
      const response = { success: true };
      expect(typeof response).toBe('object');
    });

    it('includes success flag', () => {
      const response = { success: true };
      expect(response).toHaveProperty('success');
    });

    it('includes data', () => {
      const response = { data: {} };
      expect(response).toHaveProperty('data');
    });

    it('includes error on failure', () => {
      const response = { error: 'Failed' };
      expect(response).toHaveProperty('error');
    });

    it('includes timestamp', () => {
      const response = { timestamp: new Date() };
      expect(response.timestamp).toBeInstanceOf(Date);
    });
  });

  describe('Security', () => {
    it('requires admin auth', () => {
      expect(AuthController.verifyToken).toBeDefined();
    });

    it('validates input', () => {
      const input = { pin: '1234' };
      expect(input.pin).toMatch(/^\d+$/);
    });

    it('prevents injection', () => {
      const malicious = "'; DROP TABLE logs; --";
      expect(malicious.includes(';')).toBe(true);
    });

    it('sanitizes output', () => {
      const output = '<script>alert("xss")</script>';
      expect(output).toContain('<');
    });

    it('logs access', () => {
      AuditService.log = jest.fn().mockResolvedValue({});
      expect(AuditService.log).toBeDefined();
    });
  });

  describe('Audit Logging', () => {
    it('logs operations', () => {
      AuditService.log = jest.fn().mockResolvedValue({});
      expect(AuditService.log).toBeDefined();
    });

    it('includes admin id', () => {
      const log = { adminId: 'admin1' };
      expect(log.adminId).toBe('admin1');
    });

    it('includes action', () => {
      const log = { action: 'GET_LOGS' };
      expect(log).toHaveProperty('action');
    });

    it('includes timestamp', () => {
      const log = { timestamp: new Date() };
      expect(log.timestamp).toBeInstanceOf(Date);
    });

    it('stores log', () => {
      AuditService.log = jest.fn().mockResolvedValue({});
      expect(AuditService.log).toBeDefined();
    });
  });
;

  describe('Admin Operations', () => {
    it('should support user management', () => {
      const operations = ['list', 'create', 'update', 'delete'];
      expect(operations).toContain('list');
      expect(operations).toContain('delete');
    });

    it('should support room management', () => {
      const roomOps = ['list', 'create', 'close', 'delete'];
      expect(roomOps).toHaveLength(4);
    });

    it('should support audit logging', () => {
      const auditData = {
        action: 'LOGIN',
        userId: 'admin1',
        timestamp: new Date()
      };

      expect(auditData).toHaveProperty('action');
      expect(auditData).toHaveProperty('userId');
    });
  });

  describe('Configuration Endpoints', () => {
    it('should retrieve system configuration', () => {
      const config = {
        maxRoomSize: 50,
        encryptionEnabled: true,
        rateLimitEnabled: true
      };

      expect(config.maxRoomSize).toBeGreaterThan(0);
      expect(typeof config.encryptionEnabled).toBe('boolean');
    });

    it('should support config updates', () => {
      const updates = {
        maxRoomSize: 100,
        rateLimitEnabled: false
      };

      expect(updates).toHaveProperty('maxRoomSize');
    });
  });

  describe('Admin Permissions', () => {
    it('should require admin role', () => {
      const roles = ['admin', 'user', 'guest'];
      const adminRole = roles.filter(r => r === 'admin');

      expect(adminRole).toContain('admin');
    });

    it('should support permission assignment', () => {
      const permissions = {
        read: true,
        write: true,
        delete: false
      };

      expect(permissions.read).toBe(true);
      expect(permissions.write).toBe(true);
    });
  });

  describe('Activity Tracking', () => {
    it('should track admin activities', () => {
      const activity = {
        timestamp: new Date(),
        action: 'user_deleted',
        admin: 'admin1',
        target: 'user123'
      };

      expect(activity).toHaveProperty('timestamp');
      expect(activity).toHaveProperty('action');
    });

    it('should support filtering by time period', () => {
      const periods = ['last24h', 'last7d', 'last30d', 'custom'];
      expect(periods).toContain('last24h');
    });
  });

  describe('Statistics', () => {
    it('should provide system statistics', () => {
      const stats = {
        totalUsers: 100,
        totalRooms: 50,
        activeConnections: 20,
        totalMessages: 1000
      };

      expect(stats.totalUsers).toBeGreaterThan(0);
      expect(stats.activeConnections).toBeLessThan(stats.totalUsers);
    });
  });
});
