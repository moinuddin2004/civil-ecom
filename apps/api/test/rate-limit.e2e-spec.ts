import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createTestApp, type TestApp } from './utils/test-app.js';

/** SPEC §7.1 rate limits, per IP. Other suites turn limits off; this one turns them back on. */
describe('Rate limits', () => {
  let testApp: TestApp;
  let server: Parameters<typeof request>[0];

  beforeAll(async () => {
    testApp = await createTestApp({ env: { RATE_LIMIT_ENABLED: 'true' } });
    server = testApp.app.getHttpServer() as Parameters<typeof request>[0];
  });

  afterAll(async () => {
    await testApp?.close();
  });

  it('allows 10 customer logins per 15 minutes, then answers RATE_LIMITED', async () => {
    for (let attempt = 0; attempt < 10; attempt++) {
      await request(server).post('/api/auth/login').send({ identifier: 'nobody@example.com', password: 'Wrong12345' }).expect(401);
    }
    const limited = await request(server)
      .post('/api/auth/login')
      .send({ identifier: 'nobody@example.com', password: 'Wrong12345' })
      .expect(429);
    expect(limited.body.error.code).toBe('RATE_LIMITED');
  }, 60_000);

  it('allows 5 staff logins per 15 minutes', async () => {
    for (let attempt = 0; attempt < 5; attempt++) {
      await request(server).post('/api/admin/auth/login').send({ email: 'nobody@aricon.com.pk', password: 'Wrong12345' }).expect(401);
    }
    await request(server).post('/api/admin/auth/login').send({ email: 'nobody@aricon.com.pk', password: 'Wrong12345' }).expect(429);
  }, 60_000);

  it('never limits the health check (uptime monitors poll it)', async () => {
    for (let attempt = 0; attempt < 20; attempt++) await request(server).get('/api/health').expect(200);
  });
});
