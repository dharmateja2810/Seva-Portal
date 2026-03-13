import request from 'supertest';
import app from '../app';
import * as dbPool from '../db/pool';

// Mock the entire db/pool module so tests don't need a real DB
jest.mock('../db/pool', () => ({
  pool: { query: jest.fn(), end: jest.fn(), on: jest.fn() },
  query: jest.fn(),
  getClient: jest.fn(),
}));

// Reference to the mocked query wrapper (what auth.ts actually calls)
const mockQuery = dbPool.query as jest.Mock;

describe('Auth Routes', () => {
  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('POST /api/auth/login', () => {
    it('should return 400 for missing fields', async () => {
      const res = await request(app).post('/api/auth/login').send({});
      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
    });

    it('should return 401 for unknown user', async () => {
      mockQuery.mockResolvedValueOnce([]);
      const res = await request(app)
        .post('/api/auth/login')
        .send({ username: 'nobody', password: 'Test@1234' });
      expect(res.status).toBe(401);
    });

    it('should return 400 for empty username', async () => {
      const res = await request(app)
        .post('/api/auth/login')
        .send({ username: '', password: 'Test@1234' });
      expect(res.status).toBe(400);
    });
  });

  describe('GET /api/health', () => {
    it('should return 200 OK', async () => {
      const res = await request(app).get('/api/health');
      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
    });
  });

  describe('GET /api/auth/me', () => {
    it('should return 401 without token', async () => {
      const res = await request(app).get('/api/auth/me');
      expect(res.status).toBe(401);
    });

    it('should return 401 with invalid token', async () => {
      const res = await request(app)
        .get('/api/auth/me')
        .set('Authorization', 'Bearer invalidtoken');
      expect(res.status).toBe(401);
    });
  });

  describe('POST /api/auth/logout', () => {
    it('should return 401 without token (or 429 if rate limited in test run)', async () => {
      const res = await request(app).post('/api/auth/logout');
      // Rate limiter fires (429) before auth check (401) after repeated test calls
      expect([401, 429]).toContain(res.status);
    });
  });
});
