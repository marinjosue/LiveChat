const { AuditService } = require('../../services/auditService');

jest.mock('../../models/AuditLog');

describe('AuditService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('static methods', () => {
    it('should have log method', () => {
      expect(typeof AuditService.log).toBe('function');
    });

    it('should have logLoginSuccess method', () => {
      expect(typeof AuditService.logLoginSuccess).toBe('function');
    });

    it('should have logLoginFailure method', () => {
      expect(typeof AuditService.logLoginFailure).toBe('function');
    });

    it('should have log2FASuccess method', () => {
      expect(typeof AuditService.log2FASuccess).toBe('function');
    });

    it('should have log2FAFailure method', () => {
      expect(typeof AuditService.log2FAFailure).toBe('function');
    });

    it('should have logRoomCreated method', () => {
      expect(typeof AuditService.logRoomCreated).toBe('function');
    });

    it('should have logSteganographyDetected method', () => {
      expect(typeof AuditService.logSteganographyDetected).toBe('function');
    });

    it('should have logFileRejected method', () => {
      expect(typeof AuditService.logFileRejected).toBe('function');
    });

    it('should have logSuspiciousActivity method', () => {
      expect(typeof AuditService.logSuspiciousActivity).toBe('function');
    });

    it('should have getLogs method', () => {
      expect(typeof AuditService.getLogs).toBe('function');
    });

    it('should have verifyLogsIntegrity method', () => {
      expect(typeof AuditService.verifyLogsIntegrity).toBe('function');
    });
  });
});

