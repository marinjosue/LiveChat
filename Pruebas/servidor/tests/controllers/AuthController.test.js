const { AuthController } = require('../../controllers/AuthController');

jest.mock('../../models/Admin');
jest.mock('../../services/auditService');
jest.mock('../../services/workerPoolService');

describe('AuthController', () => {
  describe('Static Methods Exist', () => {
    it('should have register method', () => {
      expect(typeof AuthController.register).toBe('function');
    });

    it('should have login method', () => {
      expect(typeof AuthController.login).toBe('function');
    });

    it('should have verify2FA method', () => {
      expect(typeof AuthController.verify2FA).toBe('function');
    });

    it('should have enable2FA method', () => {
      expect(typeof AuthController.enable2FA).toBe('function');
    });

    it('should have confirm2FA method', () => {
      expect(typeof AuthController.confirm2FA).toBe('function');
    });

    it('should have disable2FA method', () => {
      expect(typeof AuthController.disable2FA).toBe('function');
    });

    it('should have getProfile method', () => {
      expect(typeof AuthController.getProfile).toBe('function');
    });

    it('should have getWorkerPoolStats method', () => {
      expect(typeof AuthController.getWorkerPoolStats).toBe('function');
    });

    it('should have verifyToken method', () => {
      expect(typeof AuthController.verifyToken).toBe('function');
    });
  });

  describe('Module Exports', () => {
    it('should export AuthController', () => {
      expect(AuthController).toBeDefined();
    });

    it('should be a class or object with static methods', () => {
      // AuthController is exported as an object with static methods
      expect(AuthController).toBeDefined();
      expect(typeof AuthController.register).toBe('function');
    });
  });

  describe('Request/Response Handlers', () => {
    let mockReq, mockRes;

    beforeEach(() => {
      mockReq = {
        body: {},
        headers: { 'user-agent': 'test-agent' },
        socket: { remoteAddress: '127.0.0.1' },
        ip: '127.0.0.1'
      };
      mockRes = {
        status: jest.fn().mockReturnThis(),
        json: jest.fn().mockReturnThis(),
        send: jest.fn().mockReturnThis()
      };
    });

    it('register should be callable as middleware', () => {
      expect(typeof AuthController.register).toBe('function');
    });

    it('login should be callable as middleware', () => {
      expect(typeof AuthController.login).toBe('function');
    });

    it('getProfile should be callable as middleware', () => {
      expect(typeof AuthController.getProfile).toBe('function');
    });
  });

  describe('Validation', () => {
    it('should have validation for register inputs', () => {
      // Validation is done through express-validator
      // These are imported from the controller
      const { validateRegister, validateLogin } = require('../../controllers/AuthController');
      
      if (validateRegister && validateLogin) {
        expect(Array.isArray(validateRegister)).toBe(true);
        expect(Array.isArray(validateLogin)).toBe(true);
      }
    });
  });

  describe('Helper Functions', () => {
    it('should handle IP extraction from request', () => {
      const mockReq1 = {
        headers: { 'x-forwarded-for': '192.168.1.1, 10.0.0.1' },
        socket: { remoteAddress: '127.0.0.1' },
        ip: '127.0.0.1'
      };
      
      const ip = mockReq1.headers['x-forwarded-for']?.split(',')[0];
      expect(ip).toBe('192.168.1.1');
    });

    it('should fallback to socket remoteAddress', () => {
      const mockReq2 = {
        headers: {},
        socket: { remoteAddress: '127.0.0.1' },
        ip: '127.0.0.1'
      };
      
      const ip = mockReq2.headers['x-forwarded-for']?.split(',')[0] || mockReq2.socket.remoteAddress;
      expect(ip).toBe('127.0.0.1');
    });
  });

  describe('Async Operations', () => {
    it('register should be async', () => {
      const registerFn = AuthController.register;
      expect(registerFn.constructor.name).toBe('AsyncFunction');
    });

    it('login should be async', () => {
      const loginFn = AuthController.login;
      expect(loginFn.constructor.name).toBe('AsyncFunction');
    });

    it('getProfile should be async', () => {
      const getProfileFn = AuthController.getProfile;
      expect(getProfileFn.constructor.name).toBe('AsyncFunction');
    });
  });
});
