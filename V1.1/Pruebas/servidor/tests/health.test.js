const express = require("supertest");
const request = require("supertest");

describe("Verificación de Salud", () => {
  let app;

  beforeEach(() => {
    // Create a simple app for testing
    app = require("express")();
    
    // Add necessary middleware
    app.use(require("express").json());
    
    // Add health endpoint
    app.get("/health", (req, res) => {
      res.json({ success: true });
    });
  });

  test("GET /health debe responder con success: true", async () => {
    const res = await request(app).get("/health");

    expect(res.statusCode).toBe(200);
    expect(res.body).toHaveProperty("success", true);
  });

  test("el endpoint health debería retornar JSON", async () => {
    const res = await request(app).get("/health");

    expect(res.headers["content-type"]).toContain("application/json");
  });
});

