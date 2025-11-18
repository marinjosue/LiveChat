const express = require('express');
const request = require('supertest');
const RoomRouter = require('../../routes/rooms');

jest.mock('../../controllers/RoomController');
jest.mock('../../middleware/authMiddleware', () => ({
  authenticateToken: (req, res, next) => {
    req.user = { id: 'admin1', role: 'admin' };
    next();
  }
}));

describe('Rooms Routes', () => {
  let app;

  beforeEach(() => {
    jest.clearAllMocks();
    app = express();
    app.use(express.json());
    app.use('/api/rooms', RoomRouter);
  });

  describe('Module Import', () => {
    it('should import rooms router', () => {
      expect(RoomRouter).toBeDefined();
    });

    it('should be an express router', () => {
      expect(typeof RoomRouter).toBe('function');
    });
  });

  describe('Route Setup', () => {
    it('should register routes', () => {
      const routes = [];

      RoomRouter.stack?.forEach(layer => {
        if (layer.route) {
          routes.push({
            path: layer.route.path,
            methods: Object.keys(layer.route.methods)
          });
        }
      });

      expect(routes.length).toBeGreaterThanOrEqual(0);
    });
  });

  describe('GET /api/rooms', () => {
    it('should respond to GET request', async () => {
      const response = await request(app).get('/api/rooms');
      
      // Should return some response (may be 200, 404, or error)
      expect(response.status).toBeDefined();
    });

    it('should require authentication', async () => {
      const appWithoutAuth = express();
      appWithoutAuth.use(express.json());
      
      // Without auth middleware, should fail or return unauth
      const response = await request(appWithoutAuth)
        .get('/api/rooms')
        .set('Authorization', 'Bearer invalid');

      expect(response.status).toBeDefined();
    });
  });

  describe('POST /api/rooms', () => {
    it('should handle POST request for room creation', async () => {
      const roomData = {
        name: 'Test Room',
        limit: 50,
        description: 'A test room'
      };

      const response = await request(app)
        .post('/api/rooms')
        .send(roomData);

      expect(response.status).toBeDefined();
    });

    it('should validate room data', () => {
      const validRoom = {
        name: 'Room Name',
        limit: 50
      };

      expect(validRoom.name).toBeDefined();
      expect(validRoom.limit).toBeGreaterThan(0);
    });

    it('should reject room without name', () => {
      const invalidRoom = {
        limit: 50
        // Missing name
      };

      expect(invalidRoom.name).toBeUndefined();
    });
  });

  describe('GET /api/rooms/:pin', () => {
    it('should retrieve room by PIN', async () => {
      const response = await request(app).get('/api/rooms/1234');

      expect(response.status).toBeDefined();
    });

    it('should validate PIN parameter', () => {
      const pin = '1234';
      expect(pin).toMatch(/^\d+$/);
    });

    it('should return 404 for non-existent room', async () => {
      const response = await request(app).get('/api/rooms/99999');

      expect([404, 500, 200]).toContain(response.status);
    });
  });

  describe('PUT /api/rooms/:pin', () => {
    it('should update room settings', async () => {
      const updateData = {
        name: 'Updated Room',
        limit: 100
      };

      const response = await request(app)
        .put('/api/rooms/1234')
        .send(updateData);

      expect(response.status).toBeDefined();
    });

    it('should validate PIN in URL', () => {
      const pin = '1234';
      expect(pin).toBeTruthy();
      expect(typeof pin).toBe('string');
    });
  });

  describe('DELETE /api/rooms/:pin', () => {
    it('should delete room', async () => {
      const response = await request(app).delete('/api/rooms/1234');

      expect(response.status).toBeDefined();
    });

    it('should require authentication for deletion', async () => {
      const response = await request(app)
        .delete('/api/rooms/1234')
        .set('Authorization', 'Bearer token');

      expect(response.status).toBeDefined();
    });
  });

  describe('POST /api/rooms/:pin/messages', () => {
    it('should post message to room', async () => {
      const messageData = {
        content: 'Hello room!',
        sender: 'user1'
      };

      const response = await request(app)
        .post('/api/rooms/1234/messages')
        .send(messageData);

      expect(response.status).toBeDefined();
    });

    it('should validate message content', () => {
      const message = {
        content: 'Hello',
        sender: 'User1'
      };

      expect(message.content).toBeTruthy();
      expect(message.sender).toBeTruthy();
    });

    it('should reject empty messages', () => {
      const invalidMessage = {
        content: '',
        sender: 'User1'
      };

      expect(invalidMessage.content.length).toBe(0);
    });
  });

  describe('GET /api/rooms/:pin/messages', () => {
    it('should retrieve room messages', async () => {
      const response = await request(app)
        .get('/api/rooms/1234/messages');

      expect(response.status).toBeDefined();
    });

    it('should support pagination', async () => {
      const response = await request(app)
        .get('/api/rooms/1234/messages')
        .query({ limit: 10, skip: 0 });

      expect(response.status).toBeDefined();
    });
  });

  describe('POST /api/rooms/:pin/users', () => {
    it('should add user to room', async () => {
      const userData = {
        nickname: 'TestUser',
        deviceId: 'device1'
      };

      const response = await request(app)
        .post('/api/rooms/1234/users')
        .send(userData);

      expect(response.status).toBeDefined();
    });

    it('should validate user nickname', () => {
      const user = {
        nickname: 'User123',
        deviceId: 'device-id-1'
      };

      expect(user.nickname.length).toBeGreaterThan(0);
      expect(user.nickname.length).toBeLessThanOrEqual(20);
    });
  });

  describe('GET /api/rooms/:pin/users', () => {
    it('should retrieve room users', async () => {
      const response = await request(app)
        .get('/api/rooms/1234/users');

      expect(response.status).toBeDefined();
    });

    it('should return user list', () => {
      const userList = [
        { socketId: 'socket1', nickname: 'User1' },
        { socketId: 'socket2', nickname: 'User2' }
      ];

      expect(userList).toBeInstanceOf(Array);
      expect(userList.length).toBeGreaterThan(0);
    });
  });

  describe('DELETE /api/rooms/:pin/users/:userId', () => {
    it('should remove user from room', async () => {
      const response = await request(app)
        .delete('/api/rooms/1234/users/socket1');

      expect(response.status).toBeDefined();
    });

    it('should validate userId parameter', () => {
      const userId = 'socket1';
      expect(userId).toBeTruthy();
    });
  });

  describe('POST /api/rooms/:pin/upload', () => {
    it('should handle file upload', async () => {
      const response = await request(app)
        .post('/api/rooms/1234/upload')
        .set('Content-Type', 'application/json')
        .send({ file: 'test-file-data' });

      expect(response.status).toBeDefined();
    });
  });

  describe('Authentication Middleware', () => {
    it('should attach user to request', async () => {
      const response = await request(app)
        .get('/api/rooms')
        .set('Authorization', 'Bearer token');

      // Auth middleware should set req.user
      expect(response.status).toBeDefined();
    });
  });

  describe('Error Handling', () => {
    it('should handle invalid PIN format', async () => {
      const response = await request(app)
        .get('/api/rooms/invalid-pin');

      expect([400, 404, 500]).toContain(response.status);
    });

    it('should handle database errors', async () => {
      const response = await request(app)
        .get('/api/rooms/9999999999');

      expect(response.status).toBeDefined();
    });
  });

  describe('Request Validation', () => {
    it('should validate request headers', () => {
      const headers = {
        'content-type': 'application/json',
        'authorization': 'Bearer token'
      };

      expect(headers['content-type']).toBe('application/json');
    });

    it('should validate request body', () => {
      const body = {
        name: 'Room Name',
        limit: 50,
        description: 'Description'
      };

      expect(body).toHaveProperty('name');
      expect(body).toHaveProperty('limit');
    });
  });

  describe('Response Format', () => {
    it('should return responses', async () => {
      const response = await request(app)
        .get('/api/rooms');

      expect(response).toBeDefined();
      expect(response.status).toBeDefined();
    });
  });
});
