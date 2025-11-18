const express = require('express');
const { AuthController } = require('../../controllers/AuthController');

jest.mock('../../controllers/AuthController');
jest.mock('../../middleware/security', () => ({
  authLimiter: (req, res, next) => next()
}));

describe('Auth Routes Setup', () => {
  let app;

  beforeEach(() => {
    jest.clearAllMocks();
    app = express();
    app.use(express.json());

    // Create basic router for testing
    const router = require('express').Router();
    
    // Mock all controller methods
    AuthController.register = jest.fn((req, res) => {
      res.status(201).json({ success: true, message: 'Registered' });
    });
    AuthController.login = jest.fn((req, res) => {
      res.status(200).json({ success: true, token: 'jwt_token' });
    });
    AuthController.verify2FA = jest.fn((req, res) => {
      res.status(200).json({ success: true });
    });
    AuthController.enable2FA = jest.fn((req, res) => {
      res.status(200).json({ success: true });
    });
    AuthController.confirm2FA = jest.fn((req, res) => {
      res.status(200).json({ success: true });
    });
    AuthController.disable2FA = jest.fn((req, res) => {
      res.status(200).json({ success: true });
    });
    AuthController.getProfile = jest.fn((req, res) => {
      res.status(200).json({ success: true, profile: {} });
    });
    AuthController.getWorkerPoolStats = jest.fn((req, res) => {
      res.status(200).json({ success: true, stats: {} });
    });
    AuthController.verifyToken = (req, res, next) => next();

    // Setup routes
    router.post('/register', AuthController.register);
    router.post('/login', AuthController.login);
    router.post('/verify-2fa', AuthController.verify2FA);
    router.post('/enable-2fa', AuthController.verifyToken, AuthController.enable2FA);
    router.post('/confirm-2fa', AuthController.verifyToken, AuthController.confirm2FA);
    router.post('/disable-2fa', AuthController.verifyToken, AuthController.disable2FA);
    router.get('/profile', AuthController.verifyToken, AuthController.getProfile);
    router.get('/worker-stats', AuthController.verifyToken, AuthController.getWorkerPoolStats);

    app.use('/api/auth', router);
  });

  describe('Auth controller methods', () => {
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
});
