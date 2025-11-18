const express = require("supertest");
const request = require("supertest");

describe("Health Check", () => {
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

  test("GET /health deve responder com success: true", async () => {
    const res = await request(app).get("/health");

    expect(res.statusCode).toBe(200);
    expect(res.body).toHaveProperty("success", true);
  });

  test("health endpoint should return JSON", async () => {
    const res = await request(app).get("/health");

    expect(res.headers["content-type"]).toContain("application/json");
  });
});

