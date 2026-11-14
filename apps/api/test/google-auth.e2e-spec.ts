import { AUTH_COOKIES } from '@aricon/shared';
import { getModelToken } from '@nestjs/mongoose';
import type { Model } from 'mongoose';
import request, { type Response } from 'supertest';
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import { User } from '../src/models/user.model.js';
import {
  GOOGLE_OAUTH_COOKIE,
  safeNextPath,
} from '../src/modules/auth/google/google-oauth.service.js';
import {
  GoogleIdentityService,
} from '../src/modules/auth/google/google-identity.service.js';
import type { GoogleIdentity } from '../src/modules/auth/google/google-id-token.js';
import { TokenService } from '../src/modules/auth/token.service.js';
import { NotificationsService } from '../src/modules/notifications/notifications.service.js';
import { createStaff, ORIGIN, PASSWORD, setCookies, uniqueContact } from './utils/auth.js';
import { createTestApp, type TestApp } from './utils/test-app.js';

const C = AUTH_COOKIES.customer;
const APP = 'http://localhost:3000';
let subjectCounter = 0;

describe('Google customer sign-in', () => {
  let testApp: TestApp;
  let server: Parameters<typeof request>[0];
  let identity: GoogleIdentityService;

  beforeAll(async () => {
    testApp = await createTestApp();
    server = testApp.app.getHttpServer() as Parameters<typeof request>[0];
    identity = testApp.app.get(GoogleIdentityService);
  });

  afterAll(async () => {
    await testApp?.close();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  /** Starts a flow and returns the state from Google's URL and the signed state cookie. */
  async function start(next?: string) {
    const req = request(server).get('/api/auth/google/start');
    if (next !== undefined) req.query({ next });
    const res = await req.expect(302);
    const location = new URL(res.headers.location as string);
    const cookie = setCookies(res).get(GOOGLE_OAUTH_COOKIE);
    expect(cookie).toBeDefined();
    return {
      res,
      location,
      state: location.searchParams.get('state') ?? '',
      cookie: cookie as { value: string; header: string },
    };
  }

  function callback(flow: { state: string; cookie: { value: string } }, query: Record<string, string>) {
    return request(server)
      .get('/api/auth/google/callback')
      .query(query)
      .set('Cookie', `${GOOGLE_OAUTH_COOKIE}=${flow.cookie.value}`);
  }

  async function callbackWithIdentity(identityResult: GoogleIdentity, flow?: { state: string; cookie: { value: string } }) {
    const activeFlow = flow ?? (await start());
    vi.spyOn(identity, 'exchangeCode').mockResolvedValue(identityResult);
    return callback(activeFlow, { code: 'one-time-code', state: activeFlow.state }).expect(302);
  }

  function googleUser(overrides: Partial<GoogleIdentity> = {}): GoogleIdentity {
    return {
      subject: `google-subject-${(subjectCounter += 1)}`, // unique: one Google account per customer
      email: 'google.customer@example.com',
      name: 'Google Customer',
      emailVerified: true,
      ...overrides,
    };
  }

  function loginRedirect(res: Response, reason: string): void {
    const url = new URL(res.headers.location as string);
    expect(url.origin).toBe(APP);
    expect(url.pathname).toBe('/login');
    expect(url.searchParams.get('error')).toBe(reason);
  }

  it('starts with state, PKCE and a nonce in a signed httpOnly cookie', async () => {
    const flow = await start('/account/orders');
    expect(flow.location.origin).toBe('https://accounts.google.com');
    expect(flow.location.pathname).toBe('/o/oauth2/v2/auth');

    const params = flow.location.searchParams;
    expect(params.get('client_id')).toBe('test-google-client-id.apps.googleusercontent.com');
    expect(params.get('redirect_uri')).toBe(`${APP}/api/auth/google/callback`);
    expect(params.get('response_type')).toBe('code');
    expect(params.get('scope')).toBe('openid email profile');
    expect(params.get('state')).toMatch(/^[A-Za-z0-9_-]{43}$/);
    expect(params.get('nonce')).toMatch(/^[A-Za-z0-9_-]{43}$/);
    expect(params.get('code_challenge')).toMatch(/^[A-Za-z0-9_-]{43}$/);
    expect(params.get('code_challenge_method')).toBe('S256');
    expect(params.get('prompt')).toBe('select_account');

    expect(flow.cookie.header).toMatch(/HttpOnly/i);
    expect(flow.cookie.header).toMatch(/SameSite=Lax/i);
    expect(flow.cookie.header).toMatch(/Path=\/api\/auth\/google/i);
  });

  it('treats a cancelled Google prompt as a normal, explained outcome', async () => {
    const flow = await start();
    const res = await callback(flow, { error: 'access_denied' }).expect(302);
    loginRedirect(res, 'google_cancelled');
    expect(setCookies(res).get(GOOGLE_OAUTH_COOKIE)?.value).toBe('');
  });

  it('refuses a callback with no state cookie or a mismatched state', async () => {
    const noCookie = await request(server)
      .get('/api/auth/google/callback')
      .query({ code: 'code', state: 'state' })
      .expect(302);
    loginRedirect(noCookie, 'google_failed');

    const flow = await start();
    const mismatch = await callback(flow, { code: 'code', state: 'another-state' }).expect(302);
    loginRedirect(mismatch, 'google_failed');
  });

  it('refuses an exchange that fails and an email Google has not verified', async () => {
    const failedFlow = await start();
    vi.spyOn(identity, 'exchangeCode').mockRejectedValue(new Error('Google is down'));
    const failed = await callback(failedFlow, { code: 'code', state: failedFlow.state }).expect(302);
    loginRedirect(failed, 'google_failed');

    const unverified = await callbackWithIdentity(
      { ...googleUser(), emailVerified: false } as unknown as GoogleIdentity,
    );
    loginRedirect(unverified, 'google_unverified');
  });

  it('creates a verified customer, starts a normal session and welcomes them', async () => {
    const welcome = vi.spyOn(testApp.app.get(NotificationsService), 'notify').mockResolvedValue();
    const contact = uniqueContact();
    const flow = await start('/account/orders');
    const res = await callbackWithIdentity(googleUser({ email: contact.email }), flow);

    expect(res.headers.location).toBe(`${APP}/account/orders`);
    const cookies = setCookies(res);
    expect(cookies.get(C.access)?.header).toMatch(/HttpOnly/i);
    expect(cookies.get(C.refresh)?.header).toMatch(/HttpOnly/i);
    expect(cookies.get(C.refresh)?.header).toMatch(/SameSite=Strict/i);

    const me = await request(server)
      .get('/api/auth/me')
      .set('Cookie', `${C.access}=${cookies.get(C.access)?.value}`)
      .expect(200);
    expect(me.body.data).toMatchObject({ email: contact.email, role: 'CUSTOMER' });

    const saved = await testApp.app
      .get<Model<User>>(getModelToken(User.name))
      .findOne({ email: contact.email })
      .lean()
      .exec();
    expect(saved).toMatchObject({ role: 'CUSTOMER', emailVerified: true, status: 'active' });
    expect(saved?.emailVerifiedAt).toEqual(expect.any(Date));
    expect(saved?.phone).toBeUndefined();
    expect(welcome).toHaveBeenCalledWith('user.welcome', expect.objectContaining({ to: contact.email }));
  });

  it('links an existing unverified customer without changing their account', async () => {
    const contact = uniqueContact();
    await request(server)
      .post('/api/auth/signup')
      .set('Origin', ORIGIN)
      .send({ name: 'Existing Customer', email: contact.email, phone: contact.phone, password: PASSWORD })
      .expect(201);

    const flow = await start();
    const res = await callbackWithIdentity(googleUser({ email: contact.email }), flow);
    expect(res.headers.location).toBe(`${APP}/account`);

    const saved = await testApp.app
      .get<Model<User>>(getModelToken(User.name))
      .findOne({ email: contact.email })
      .lean()
      .exec();
    expect(saved).toMatchObject({ name: 'Existing Customer', emailVerified: true });
    expect(saved?.phone).toBe(contact.phone);

    await request(server)
      .get('/api/auth/me')
      .set('Cookie', `${C.access}=${setCookies(res).get(C.access)?.value}`)
      .expect(200);
  });

  it('replaces the sign-up password and ends sessions when Google verifies an unverified account', async () => {
    const contact = uniqueContact();
    const created = await request(server)
      .post('/api/auth/signup')
      .set('Origin', ORIGIN)
      .send({ name: 'Existing Customer', email: contact.email, phone: contact.phone, password: PASSWORD })
      .expect(201);
    // A session opened with the sign-up password before the real owner showed up.
    const early = await testApp.app.get(TokenService).startSession(created.body.data.id as string, 'customer', {});

    const res = await callbackWithIdentity(googleUser({ email: contact.email, subject: 'sub-owner' }), await start());
    expect(res.headers.location).toBe(`${APP}/account`);

    await request(server)
      .post('/api/auth/login')
      .set('Origin', ORIGIN)
      .send({ identifier: contact.email, password: PASSWORD })
      .expect(401);
    await request(server)
      .post('/api/auth/refresh')
      .set('Origin', ORIGIN)
      .set('Cookie', `${C.refresh}=${early.refreshToken}`)
      .expect(401);
    const saved = await testApp.app
      .get<Model<User>>(getModelToken(User.name))
      .findOne({ email: contact.email })
      .lean()
      .exec();
    expect(saved).toMatchObject({ emailVerified: true, googleSub: 'sub-owner' });
    expect(saved?.tokensValidAfter).toEqual(expect.any(Date));
  });

  it('keeps the password of an account that was already verified', async () => {
    const contact = uniqueContact();
    await request(server)
      .post('/api/auth/signup')
      .set('Origin', ORIGIN)
      .send({ name: 'Verified Customer', email: contact.email, phone: contact.phone, password: PASSWORD })
      .expect(201);
    await testApp.app
      .get<Model<User>>(getModelToken(User.name))
      .updateOne({ email: contact.email }, { $set: { emailVerified: true } });

    await callbackWithIdentity(googleUser({ email: contact.email }), await start());
    await request(server)
      .post('/api/auth/login')
      .set('Origin', ORIGIN)
      .send({ identifier: contact.email, password: PASSWORD })
      .expect(200);
  });

  it('links one Google account per customer and refuses a different one', async () => {
    const contact = uniqueContact();
    const first = await callbackWithIdentity(googleUser({ email: contact.email, subject: 'sub-original' }), await start());
    expect(first.headers.location).toBe(`${APP}/account`);

    const again = await callbackWithIdentity(googleUser({ email: contact.email, subject: 'sub-original' }), await start());
    expect(again.headers.location).toBe(`${APP}/account`);

    const other = await callbackWithIdentity(googleUser({ email: contact.email, subject: 'sub-impostor' }), await start());
    loginRedirect(other, 'google_account_mismatch');
    expect(setCookies(other).get(C.access)).toBeUndefined();

    const saved = await testApp.app
      .get<Model<User>>(getModelToken(User.name))
      .findOne({ email: contact.email })
      .lean()
      .exec();
    expect(saved?.googleSub).toBe('sub-original');
  });

  it('links an existing customer without a stored Google account on first Google sign-in', async () => {
    const contact = uniqueContact();
    const users = testApp.app.get<Model<User>>(getModelToken(User.name));
    await request(server)
      .post('/api/auth/signup')
      .set('Origin', ORIGIN)
      .send({ name: 'Linked Customer', email: contact.email, phone: contact.phone, password: PASSWORD })
      .expect(201);
    await users.updateOne({ email: contact.email }, { $set: { emailVerified: true } });
    await callbackWithIdentity(googleUser({ email: contact.email, subject: 'sub-linked' }), await start());
    expect((await users.findOne({ email: contact.email }).lean().exec())?.googleSub).toBe('sub-linked');
  });

  it('rejects a staff email without linking it or changing the role', async () => {
    const staff = await createStaff(testApp.app, { role: 'STAFF' });
    const flow = await start();
    const res = await callbackWithIdentity(googleUser({ email: staff.email }), flow);

    loginRedirect(res, 'google_staff');
    expect(setCookies(res).get(C.access)).toBeUndefined();
    expect(setCookies(res).get(C.refresh)).toBeUndefined();

    const saved = await testApp.app
      .get<Model<User>>(getModelToken(User.name))
      .findById(staff.id)
      .lean()
      .exec();
    expect(saved).toMatchObject({ role: 'STAFF', emailVerified: true });
    expect(saved?.phone).toBeUndefined();
  });

  it('rejects a blocked customer', async () => {
    const contact = uniqueContact();
    await request(server)
      .post('/api/auth/signup')
      .set('Origin', ORIGIN)
      .send({ name: 'Blocked Customer', email: contact.email, phone: contact.phone, password: PASSWORD })
      .expect(201);
    await testApp.app
      .get<Model<User>>(getModelToken(User.name))
      .updateOne({ email: contact.email }, { $set: { status: 'blocked' } })
      .exec();

    const flow = await start();
    const res = await callbackWithIdentity(googleUser({ email: contact.email }), flow);
    loginRedirect(res, 'google_blocked');
    expect(setCookies(res).get(C.access)).toBeUndefined();
  });

  it('only redirects to same-site paths after sign-in', () => {
    expect(safeNextPath('/account/orders')).toBe('/account/orders');
    expect(safeNextPath('//evil.example.com')).toBe('/account');
    expect(safeNextPath('https://evil.example.com')).toBe('/account');
    expect(safeNextPath('/\\evil.example.com')).toBe('/account');
    expect(safeNextPath(undefined)).toBe('/account');
  });

  it('drops an unsafe next value when building the success redirect', async () => {
    const contact = uniqueContact();
    const flow = await start('//evil.example.com');
    const res = await callbackWithIdentity(googleUser({ email: contact.email }), flow);
    expect(res.headers.location).toBe(`${APP}/account`);
  });
});
