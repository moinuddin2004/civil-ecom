import request from 'supertest';
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { Settings, SETTINGS_ID } from '../src/models/settings.model.js';
import { NotificationsService } from '../src/modules/notifications/notifications.service.js';
import { modelOf } from './utils/fixtures.js';
import { createTestApp, type TestApp } from './utils/test-app.js';

const COMPANY_SITE = 'https://aricon.com.pk';

/** Company-website inquiries (SPEC §7.2): cross-origin from the allowlist only, emailed, not stored. */
describe('POST /api/public/rfp', () => {
  let testApp: TestApp;
  let server: Parameters<typeof request>[0];
  let notify: ReturnType<typeof vi.spyOn>;

  const inquiry = {
    company: 'Raza Builders',
    contactPerson: 'Ahmed Raza',
    email: 'Ahmed@RazaBuilders.pk',
    service: 'Structural design',
    brief: 'Four-storey commercial building; need design and supervision.',
    website: '',
  };

  beforeAll(async () => {
    testApp = await createTestApp({ env: { RFP_CORS_ORIGINS: COMPANY_SITE } });
    server = testApp.app.getHttpServer() as Parameters<typeof request>[0];
    await modelOf<Settings>(testApp.app, Settings.name).create({ _id: SETTINGS_ID, rfpEmail: 'projects@aricon.test' });
    notify = vi.spyOn(testApp.app.get(NotificationsService), 'notify');
  });

  beforeEach(() => {
    notify.mockClear();
  });

  afterAll(async () => {
    await testApp?.close();
  });

  it('accepts the form from the company website and emails it to the RFP address', async () => {
    const res = await request(server).post('/api/public/rfp').set('Origin', COMPANY_SITE).send(inquiry).expect(204);
    expect(res.headers['access-control-allow-origin']).toBe(COMPANY_SITE);
    expect(notify).toHaveBeenCalledWith(
      'rfp.inquiry',
      expect.objectContaining({ to: 'projects@aricon.test', replyTo: 'ahmed@razabuilders.pk', company: 'Raza Builders', phone: null }),
    );
  });

  it('answers the CORS preflight for allowed origins only', async () => {
    const allowed = await request(server)
      .options('/api/public/rfp')
      .set('Origin', COMPANY_SITE)
      .set('Access-Control-Request-Method', 'POST')
      .set('Access-Control-Request-Headers', 'content-type');
    expect(allowed.status).toBe(204);
    expect(allowed.headers['access-control-allow-origin']).toBe(COMPANY_SITE);
    expect(allowed.headers['access-control-allow-credentials']).toBeUndefined();

    const foreign = await request(server)
      .options('/api/public/rfp')
      .set('Origin', 'https://evil.example')
      .set('Access-Control-Request-Method', 'POST');
    expect(foreign.headers['access-control-allow-origin']).toBeUndefined();

    // No other route is open to other sites.
    const other = await request(server)
      .options('/api/auth/login')
      .set('Origin', COMPANY_SITE)
      .set('Access-Control-Request-Method', 'POST');
    expect(other.headers['access-control-allow-origin']).toBeUndefined();
  });

  it('silently drops bot submissions (honeypot filled)', async () => {
    await request(server)
      .post('/api/public/rfp')
      .set('Origin', COMPANY_SITE)
      .send({ ...inquiry, website: 'http://spam.example' })
      .expect(204);
    expect(notify).not.toHaveBeenCalled();
  });

  it('validates the fields', async () => {
    const res = await request(server)
      .post('/api/public/rfp')
      .set('Origin', COMPANY_SITE)
      .send({ ...inquiry, email: 'nope', brief: 'short', extra: 1 })
      .expect(400);
    expect(res.body.error.details.map((issue: { path: string }) => issue.path).sort()).toEqual(['brief', 'email', 'extra']);
    expect(notify).not.toHaveBeenCalled();
  });
});
