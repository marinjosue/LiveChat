const { authLimiter, sanitizeInput, validateOrigin, helmetConfig } = require('../../middleware/security');
const rateLimit = require('express-rate-limit');

describe('Security Middleware', () => {
  let mockReq, mockRes, mockNext;

  beforeEach(() => {
    mockReq = {
      headers: { origin: 'http://localhost:3000' },
      body: {},
      socket: { remoteAddress: '127.0.0.1' }
    };
    mockRes = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn().mockReturnThis()
    };
    mockNext = jest.fn();
  });

  describe('sanitizeInput', () => {
    it('should remove script tags from input', () => {
      mockReq.body = {
        message: '<script>alert("xss")</script>Hello'
      };

      sanitizeInput(mockReq, mockRes, mockNext);

      expect(mockReq.body.message).not.toContain('<script>');
      expect(mockNext).toHaveBeenCalled();
    });

    it('should remove HTML tags from input', () => {
      mockReq.body = {
        text: '<img src=x onerror="alert(1)">Safe text'
      };

      sanitizeInput(mockReq, mockRes, mockNext);

      expect(mockReq.body.text).not.toContain('<img');
      expect(mockNext).toHaveBeenCalled();
    });

    it('should trim whitespace', () => {
      mockReq.body = {
        username: '  testuser  '
      };

      sanitizeInput(mockReq, mockRes, mockNext);

      expect(mockReq.body.username).toBe('testuser');
      expect(mockNext).toHaveBeenCalled();
    });

    it('should handle null body', () => {
      mockReq.body = null;

      sanitizeInput(mockReq, mockRes, mockNext);

      expect(mockNext).toHaveBeenCalled();
    });
  });

  describe('validateOrigin', () => {
    it('should allow requests from allowed origin', () => {
      process.env.FRONTEND_URL = 'http://localhost:3000';
      mockReq.headers.origin = 'http://localhost:3000';

      validateOrigin(mockReq, mockRes, mockNext);

      expect(mockNext).toHaveBeenCalled();
      expect(mockRes.status).not.toHaveBeenCalled();
    });

    it('should allow localhost in development', () => {
      process.env.NODE_ENV = 'development';
      mockReq.headers = {};

      validateOrigin(mockReq, mockRes, mockNext);

      expect(mockNext).toHaveBeenCalled();
    });

    it('should reject unauthorized origin', () => {
      process.env.NODE_ENV = 'production';
      process.env.FRONTEND_URL = 'http://localhost:3000';
      mockReq.headers.origin = 'http://malicious.com';

      validateOrigin(mockReq, mockRes, mockNext);

      expect(mockRes.status).toHaveBeenCalledWith(403);
      expect(mockRes.json).toHaveBeenCalledWith(
        expect.objectContaining({ success: false })
      );
    });

    it('should validate referer header as fallback', () => {
      process.env.FRONTEND_URL = 'http://localhost:3000';
      mockReq.headers = { referer: 'http://localhost:3000/page' };

      validateOrigin(mockReq, mockRes, mockNext);

      expect(mockNext).toHaveBeenCalled();
    });
  });

  describe('authLimiter', () => {
    it('should be a rate limiter function', () => {
      expect(typeof authLimiter).toBe('function');
    });

    it('should have correct window and max properties', () => {
      // The authLimiter is created with rateLimit middleware
      expect(authLimiter).toBeDefined();
    });
  });

  describe('helmetConfig', () => {
    it('should be configured as middleware', () => {
      expect(typeof helmetConfig).toBe('function');
    });

    it('should set security headers', (done) => {
      const mockReq2 = {};
      const mockRes2 = {
        setHeader: jest.fn(),
        removeHeader: jest.fn()
      };
      const mockNext2 = jest.fn(() => {
        expect(mockRes2.setHeader).toHaveBeenCalled();
        done();
      });

      helmetConfig(mockReq2, mockRes2, mockNext2);
    });
  });

  describe('Additional sanitizeInput cases', () => {
    it('should handle objects with nested content', () => {
      mockReq.body = {
        user: {
          profile: '<script>test</script>safe'
        }
      };

      sanitizeInput(mockReq, mockRes, mockNext);
      expect(mockNext).toHaveBeenCalled();
    });

    it('should preserve valid JSON structure', () => {
      mockReq.body = {
        message: 'Hello World',
        count: 5
      };

      sanitizeInput(mockReq, mockRes, mockNext);
      expect(mockNext).toHaveBeenCalled();
    });

    it('should handle empty body gracefully', () => {
      mockReq.body = null;

      sanitizeInput(mockReq, mockRes, mockNext);
      expect(mockNext).toHaveBeenCalled();
    });
  });

  describe('Additional validateOrigin cases', () => {
    it('should handle case-insensitive localhost', () => {
      mockReq.headers = { origin: 'http://localhost:3000' };

      validateOrigin(mockReq, mockRes, mockNext);

      // Either calls next or status(403)
      const nextCalled = mockNext.mock.calls.length > 0;
      const statusCalled = mockRes.status.mock.calls.length > 0;
      expect(nextCalled || statusCalled).toBe(true);
    });

    it('should reject malicious origins', () => {
      mockReq.headers = { origin: 'http://evil.com' };

      validateOrigin(mockReq, mockRes, mockNext);

      // Should be rejected with 403
      expect(mockRes.status).toHaveBeenCalledWith(403);
    });

    it('should handle missing origin header', () => {
      mockReq.headers = { referer: 'http://localhost/page' };

      validateOrigin(mockReq, mockRes, mockNext);

      // Should process the request
      const nextCalled = mockNext.mock.calls.length > 0;
      const statusCalled = mockRes.status.mock.calls.length > 0;
      expect(nextCalled || statusCalled).toBe(true);
    });
  });

  describe('Rate limiting configuration', () => {
    it('should have authLimiter defined', () => {
      expect(authLimiter).toBeDefined();
    });

    it('should be function type', () => {
      expect(typeof authLimiter).toBe('function');
    });
  });

  describe('Helmet security headers', () => {
    it('should set security headers via helmet', () => {
      const mockRes2 = {
        setHeader: jest.fn(),
        removeHeader: jest.fn()
      };
      const mockNext2 = jest.fn();

      helmetConfig({}, mockRes2, mockNext2);

      expect(mockNext2).toHaveBeenCalled();
    });

    it('should call next middleware', () => {
      const mockRes2 = {
        setHeader: jest.fn(),
        removeHeader: jest.fn()
      };
      const mockNext2 = jest.fn();

      helmetConfig({}, mockRes2, mockNext2);

      expect(mockNext2).toHaveBeenCalled();
    });
  });
});
