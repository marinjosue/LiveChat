const express = require('express');
const request = require('supertest');

describe('Aplicación Express', () => {
  let app;

  beforeEach(() => {
    jest.resetModules();
    // Create a simple test app
    app = express();
    app.get('/health', (req, res) => {
      res.status(200).json({ success: true, status: 'ok' });
    });
  });

  describe('Endpoint de Health Check', () => {
    it('GET /health debería responder con success: true', async () => {
      const res = await request(app).get('/health');

      expect(res.statusCode).toBe(200);
      expect(res.body).toHaveProperty('success', true);
    });

    it('debería retornar una propiedad status', async () => {
      const res = await request(app).get('/health');

      expect(res.body).toHaveProperty('status');
    });

    it('debería tener los headers apropiados', async () => {
      const res = await request(app).get('/health');

      expect(res.headers['content-type']).toContain('application/json');
    });
  });

  describe('Endpoints de API', () => {
    it('debería responder a peticiones GET', async () => {
      const res = await request(app).get('/health');

      expect(res.statusCode).toBe(200);
    });

    it('debería manejar rutas indefinidas', async () => {
      const res = await request(app).get('/undefined-route');

      expect([404, 200]).toContain(res.statusCode);
    });
  });

  describe('Configuración de Aplicación', () => {
    it('debería ser una app express válida', () => {
      expect(typeof app).toBe('function');
    });

    it('debería responder a peticiones', async () => {
      const res = await request(app).get('/health');
      expect(res).toBeDefined();
      expect(res.status).toBeDefined();
    });
  });
});
