require("./setup"); // connect in-memory MongoDB before tests run

const request = require("supertest");
const User = require("../models/user");
const app = require("../server");

/*
 * Rate-limiter note:
 * -----------------------------------------------------------------
 * authLimiter is set to 10 requests / 15-minute window per IP.
 * supertest makes requests from 127.0.0.1, and this file has
 * exactly 8 test cases, each making 1–2 requests to /api/auth ≈ 11.
 * However, express-rate-limit tracks requests per unique store key,
 * and each Jest test run starts a fresh process (no state carried
 * over), so the counter starts at 0. The 8 tests below make at
 * most ~11 auth requests total, which CAN trip the limiter.
 *
 * To keep things simple we skip (set max = 0, i.e. disabled) the
 * rate limiter when NODE_ENV === 'test'. The rateLimitMiddleware
 * production logic itself is unchanged — we just tell this test
 * environment to set NODE_ENV.
 * -----------------------------------------------------------------
 */

/* ── clean slate between every test ────────────────────────────── */
afterEach(async () => {
  await User.deleteMany({});
});

/* ================================================================
   POST /api/auth/register
   ================================================================ */
describe("POST /api/auth/register", () => {
  it("201 + token on valid name/email/password", async () => {
    const res = await request(app).post("/api/auth/register").send({
      name: "TestUser",
      email: "test@example.com",
      password: "password123",
    });
    expect(res.status).toBe(201);
    expect(res.body).toHaveProperty("token");
    expect(res.body).toHaveProperty("_id");
    expect(res.body.email).toBe("test@example.com");
  });

  it("400 on duplicate email", async () => {
    const payload = {
      name: "First",
      email: "dup@example.com",
      password: "password123",
    };
    await request(app).post("/api/auth/register").send(payload);
    const res = await request(app).post("/api/auth/register").send({
      ...payload,
      name: "Second",
    });
    expect(res.status).toBe(400);
    expect(res.body.message).toMatch(/already exists/i);
  });

  it("400 on password under 6 characters", async () => {
    const res = await request(app).post("/api/auth/register").send({
      name: "Short",
      email: "short@example.com",
      password: "12345",
    });
    expect(res.status).toBe(400);
    expect(res.body.message).toMatch(/6 char/i);
  });

  it("400 on missing name", async () => {
    const res = await request(app).post("/api/auth/register").send({
      email: "noname@example.com",
      password: "password123",
    });
    expect(res.status).toBe(400);
    expect(res.body.message).toMatch(/name/i);
  });
});

/* ================================================================
   POST /api/auth/login
   ================================================================ */
describe("POST /api/auth/login", () => {
  const validUser = {
    name: "LoginTest",
    email: "login@example.com",
    password: "password123",
  };

  it("200 + token on correct credentials", async () => {
    await request(app).post("/api/auth/register").send(validUser);
    const res = await request(app).post("/api/auth/login").send({
      email: validUser.email,
      password: validUser.password,
    });
    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty("token");
    expect(res.body.email).toBe(validUser.email);
  });

  it("401 on wrong password", async () => {
    await request(app).post("/api/auth/register").send(validUser);
    const res = await request(app).post("/api/auth/login").send({
      email: validUser.email,
      password: "wrongpassword",
    });
    expect(res.status).toBe(401);
    expect(res.body.message).toMatch(/invalid/i);
  });

  it("401 on non-existent email", async () => {
    const res = await request(app).post("/api/auth/login").send({
      email: "nobody@example.com",
      password: "password123",
    });
    expect(res.status).toBe(401);
    expect(res.body.message).toMatch(/invalid/i);
  });

  it("400 on malformed email", async () => {
    const res = await request(app).post("/api/auth/login").send({
      email: "not-an-email",
      password: "password123",
    });
    expect(res.status).toBe(400);
    expect(res.body.message).toMatch(/valid email/i);
  });
});
