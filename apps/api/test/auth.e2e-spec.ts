import { AUTH_COOKIES, PERMISSION_KEYS, PERMISSION_PRESETS } from '@aricon/shared';
import { Controller, Get } from '@nestjs/common';
import { getModelToken } from '@nestjs/mongoose';
import type { Model } from 'mongoose';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { EmailVerificationToken } from '../src/models/email-verification-token.model.js';
import { RefreshToken } from '../src/models/refresh-token.model.js';
import { User } from '../src/models/user.model.js';
import { AuthUserCache } from '../src/modules/auth/auth-user-cache.service.js';
import { RequireAdmin, RequirePermission, StaffOnly } from '../src/modules/auth/auth.decorators.js';
import { FORGOT_PASSWORD_MESSAGE, VERIFICATION_SENT_MESSAGE } from '../src/modules/auth/customer-auth.controller.js';
import { INVALID_CREDENTIALS_MESSAGE } from '../src/modules/auth/credentials.service.js';
import { EMAIL_NOT_VERIFIED_MESSAGE } from '../src/modules/auth/email-verification.error.js';
import { NotificationsService, type NotificationEvent } from '../src/modules/notifications/notifications.service.js';
import { hashToken } from '../src/modules/auth/password-hasher.service.js';
import { REUSE_GRACE_MS, TokenService } from '../src/modules/auth/token.service.js';
import { createStaff, ORIGIN, PASSWORD, setCookies, uniqueContact } from './utils/auth.js';
import { createTestApp, type TestApp } from './utils/test-app.js';

/** Stand-ins for admin endpoints, to test the guard's policies end to end. */
@Controller('admin/probe')
class AdminProbeController {
  @Get('any')
  @StaffOnly()
  any() {
    return { ok: true };
  }

  @Get('products')
  @RequirePermission('products.view')
  products() {
    return { ok: true };
  }

  @Get('settings')
  @RequireAdmin()
  settings() {
    return { ok: true };
  }
}

/** A route someone forgot to give a policy: must be refused (secure by default). */
@Controller('forgotten')
class NoPolicyController {
  @Get()
  get() {
    return { ok: true };
  }
}

const C = AUTH_COOKIES.customer;
const A = AUTH_COOKIES.admin;
const sleep = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

describe('Authentication and authorization', () => {
  let testApp: TestApp;
  let server: Parameters<typeof request>[0];
  let sent: { event: NotificationEvent; payload: Record<string, unknown> }[] = [];

  beforeAll(async () => {
    testApp = await createTestApp({ controllers: [AdminProbeController, NoPolicyController] });
    server = testApp.app.getHttpServer() as Parameters<typeof request>[0];
    const notifications = testApp.app.get(NotificationsService);
    vi.spyOn(notifications, 'notify').mockImplementation(async (event, payload) => {
      sent.push({ event, payload: payload as Record<string, unknown> });
    });
  });

  afterAll(async () => {
    await testApp?.close();
  });

  /** The last link of a kind sent to an address, from the captured email payload. */
  function emailedToken(email: string, event: NotificationEvent): string {
    for (let index = sent.length - 1; index >= 0; index -= 1) {
      const entry = sent[index];
      if (entry?.event !== event) continue;
      if (entry.payload.to !== email) continue;
      const url = (entry.payload.verifyUrl ?? entry.payload.resetUrl) as string | undefined;
      if (url) return new URL(url).searchParams.get('token') ?? '';
    }
    throw new Error(`No ${event} email was sent to ${email}.`);
  }

  function signup(overrides: Record<string, unknown> = {}) {
    const contact = uniqueContact();
    const body = { name: 'Ahmed Raza', email: contact.email, phone: contact.phone, password: PASSWORD, ...overrides };
    return { body, send: () => request(server).post('/api/auth/signup').set('Origin', ORIGIN).send(body) };
  }

  /** Signs a customer up, verifies the address, then logs them in on `agent`. */
  async function signupVerified(options: { agent?: ReturnType<typeof request.agent>; overrides?: Record<string, unknown> } = {}) {
    const agent = options.agent ?? request.agent(server);
    const { body } = signup(options.overrides);
    const created = await agent.post('/api/auth/signup').set('Origin', ORIGIN).send(body).expect(201);
    const token = emailedToken(body.email, 'auth.verify_email');
    await request(server).post('/api/auth/verify-email').send({ token }).expect(204);
    await agent
      .post('/api/auth/login')
      .set('Origin', ORIGIN)
      .send({ identifier: body.email, password: PASSWORD })
      .expect(200);
    return { agent, body, created };
  }

  /** Signs a staff member in and returns an agent carrying their cookies. */
  async function staffAgent(options: Parameters<typeof createStaff>[1] = {}) {
    const staff = await createStaff(testApp.app, options);
    const agent = request.agent(server);
    const res = await agent
      .post('/api/admin/auth/login')
      .set('Origin', ORIGIN)
      .send({ email: staff.email, password: staff.password })
      .expect(200);
    return { agent, staff, res };
  }

  describe('customer sign-up', () => {
    it('creates an unverified customer, emails a link, and starts no session', async () => {
      const { body, send } = signup({ email: 'Mixed.Case@Example.com', phone: '0301 234 5678' });
      const res = await send().expect(201);

      expect(res.body.data).toEqual({
        id: expect.any(String),
        name: body.name,
        email: 'mixed.case@example.com',
        phone: '+923012345678',
        companyName: null,
        role: 'CUSTOMER',
      });
      expect(JSON.stringify(res.body)).not.toContain(PASSWORD);
      expect(setCookies(res).size).toBe(0);

      const users = testApp.app.get<Model<User>>(getModelToken(User.name));
      const saved = await users.findOne({ email: 'mixed.case@example.com' }).lean().exec();
      expect(saved).toMatchObject({ emailVerified: false });
      expect(saved?.emailVerifiedAt).toBeUndefined();

      const verify = sent.find(
        (entry) => entry.event === 'auth.verify_email' && entry.payload.to === 'mixed.case@example.com',
      );
      expect(verify?.payload.verifyUrl).toMatch(/\/verify-email\?token=[A-Za-z0-9_-]{43}$/);
      expect(verify?.payload.expiresInMinutes).toBe(60);
      expect(sent.some((entry) => entry.event === 'user.welcome' && entry.payload.to === 'mixed.case@example.com')).toBe(
        false,
      );
    });

    it('refuses to let a public request choose a role', async () => {
      const res = await signup({ role: 'ADMIN' }).send().expect(400);
      expect(res.body.error.details).toContainEqual({ path: 'role', message: "This field isn't allowed." });
    });

    it('rejects a taken email (any case) and a taken phone (any format)', async () => {
      const first = signup();
      await first.send().expect(201);

      const sameEmail = await signup({ email: first.body.email.toUpperCase() }).send().expect(409);
      expect(sameEmail.body.error.code).toBe('EMAIL_TAKEN');

      const localFormat = `0${first.body.phone.slice(3)}`;
      const samePhone = await signup({ phone: localFormat }).send().expect(409);
      expect(samePhone.body.error.code).toBe('PHONE_TAKEN');
    });

    it('explains password and phone problems field by field', async () => {
      const res = await signup({ password: 'short', phone: '12345' }).send().expect(400);
      const paths = (res.body.error.details as { path: string }[]).map((issue) => issue.path);
      expect(paths).toContain('password');
      expect(paths).toContain('phone');
    });
  });

  describe('email verification', () => {
    it('blocks login until the link is used, then signs in once with httpOnly cookies', async () => {
      const { body, send } = signup();
      const created = await send().expect(201);
      expect(created.body.data.id).toEqual(expect.any(String));

      const blocked = await request(server)
        .post('/api/auth/login')
        .set('Origin', ORIGIN)
        .send({ identifier: body.email, password: PASSWORD })
        .expect(403);
      expect(blocked.body.error).toMatchObject({
        code: 'EMAIL_NOT_VERIFIED',
        message: EMAIL_NOT_VERIFIED_MESSAGE,
        details: { email: body.email, canResend: true },
      });
      expect(setCookies(blocked).size).toBe(0);

      const token = emailedToken(body.email, 'auth.verify_email');
      await request(server).post('/api/auth/verify-email').send({ token }).expect(204);

      const login = await request(server)
        .post('/api/auth/login')
        .set('Origin', ORIGIN)
        .send({ identifier: body.email, password: PASSWORD })
        .expect(200);
      const cookies = setCookies(login);
      expect(cookies.get(C.access)?.header).toMatch(/HttpOnly/i);
      expect(cookies.get(C.access)?.header).toMatch(/SameSite=Lax/i);
      expect(cookies.get(C.refresh)?.header).toMatch(/HttpOnly/i);
      expect(cookies.get(C.refresh)?.header).toMatch(/SameSite=Strict/i);

      expect(sent.some((entry) => entry.event === 'user.welcome' && entry.payload.to === body.email)).toBe(true);
    });

    it('uses a link only once and refuses unknown or expired links', async () => {
      const { body, send } = signup();
      await send().expect(201);
      const token = emailedToken(body.email, 'auth.verify_email');

      await request(server).post('/api/auth/verify-email').send({ token }).expect(204);
      const again = await request(server).post('/api/auth/verify-email').send({ token }).expect(400);
      expect(again.body.error.code).toBe('VALIDATION_ERROR');

      const unknown = await request(server)
        .post('/api/auth/verify-email')
        .send({ token: 'A'.repeat(43) })
        .expect(400);
      expect(unknown.body.error.code).toBe('VALIDATION_ERROR');

      const second = signup();
      await second.send().expect(201);
      const expiredToken = emailedToken(second.body.email, 'auth.verify_email');
      await testApp.app
        .get<Model<EmailVerificationToken>>(getModelToken(EmailVerificationToken.name))
        .updateOne({ tokenHash: hashToken(expiredToken) }, { $set: { expiresAt: new Date(Date.now() - 1_000) } })
        .exec();
      const expired = await request(server)
        .post('/api/auth/verify-email')
        .send({ token: expiredToken })
        .expect(400);
      expect(expired.body.error.code).toBe('VALIDATION_ERROR');
    });

    it('resends on request without revealing the address, after the cooldown, and kills the old link', async () => {
      const { body, send } = signup();
      await send().expect(201);
      const firstToken = emailedToken(body.email, 'auth.verify_email');

      const unknown = await request(server)
        .post('/api/auth/resend-verification')
        .send({ email: 'nobody@example.com' })
        .expect(200);
      expect(unknown.body.data.message).toBe(VERIFICATION_SENT_MESSAGE);
      expect(sent.some((entry) => entry.event === 'auth.verify_email' && entry.payload.to === 'nobody@example.com')).toBe(
        false,
      );

      // The cooldown stops a second email in the first minute.
      const deliveredBefore = sent.filter(
        (entry) => entry.event === 'auth.verify_email' && entry.payload.to === body.email,
      ).length;
      await request(server).post('/api/auth/resend-verification').send({ email: body.email }).expect(200);
      expect(
        sent.filter((entry) => entry.event === 'auth.verify_email' && entry.payload.to === body.email).length,
      ).toBe(deliveredBefore);

      await testApp.app
        .get<Model<EmailVerificationToken>>(getModelToken(EmailVerificationToken.name))
        .collection.updateMany({}, { $set: { createdAt: new Date(Date.now() - 2 * 60_000) } });
      await request(server).post('/api/auth/resend-verification').send({ email: body.email }).expect(200);
      const secondToken = emailedToken(body.email, 'auth.verify_email');
      expect(secondToken).not.toBe(firstToken);

      const stale = await request(server).post('/api/auth/verify-email').send({ token: firstToken }).expect(400);
      expect(stale.body.error.code).toBe('VALIDATION_ERROR');
      await request(server).post('/api/auth/verify-email').send({ token: secondToken }).expect(204);
    });

    it('ends sessions opened before the first verification, but keeps the sign-up password', async () => {
      const { body, send } = signup();
      const created = await send().expect(201);
      const userId = created.body.data.id as string;
      const early = await testApp.app.get(TokenService).startSession(userId, 'customer', {});

      await request(server)
        .post('/api/auth/verify-email')
        .send({ token: emailedToken(body.email, 'auth.verify_email') })
        .expect(204);

      await request(server)
        .post('/api/auth/refresh')
        .set('Origin', ORIGIN)
        .set('Cookie', `${C.refresh}=${early.refreshToken}`)
        .expect(401);
      const saved = await testApp.app.get<Model<User>>(getModelToken(User.name)).findById(userId).lean().exec();
      expect(saved?.tokensValidAfter).toEqual(expect.any(Date));
      // Resetting the password here would lock out every honest sign-up, so it stays.
      await request(server)
        .post('/api/auth/login')
        .set('Origin', ORIGIN)
        .send({ identifier: body.email, password: PASSWORD })
        .expect(200);
    });

    it('refuses an unverified account even with a valid access or refresh token', async () => {
      const { send } = signup();
      const created = await send().expect(201);
      const userId = created.body.data.id as string;

      const tokens = await testApp.app.get(TokenService).startSession(userId, 'customer', {});

      const me = await request(server)
        .get('/api/auth/me')
        .set('Cookie', `${C.access}=${tokens.accessToken}`)
        .expect(403);
      expect(me.body.error.code).toBe('EMAIL_NOT_VERIFIED');

      const refresh = await request(server)
        .post('/api/auth/refresh')
        .set('Origin', ORIGIN)
        .set('Cookie', `${C.refresh}=${tokens.refreshToken}`)
        .expect(403);
      expect(refresh.body.error.code).toBe('EMAIL_NOT_VERIFIED');
    });
  });

  describe('customer login and session', () => {
    it('signs in with email or a mobile number in any format, and /me answers', async () => {
      const { agent, body } = await signupVerified();

      const me = await agent.get('/api/auth/me').expect(200);
      expect(me.body.data.email).toBe(body.email);

      const local = `0${body.phone.slice(3, 6)} ${body.phone.slice(6)}`;
      await request(server).post('/api/auth/login').set('Origin', ORIGIN).send({ identifier: local, password: PASSWORD }).expect(200);
    });

    it('gives the same answer for a wrong password and an unknown account', async () => {
      const { body, send } = signup();
      await send().expect(201);
      const wrong = await request(server)
        .post('/api/auth/login')
        .send({ identifier: body.email, password: 'Wrong12345' })
        .expect(401);
      const unknown = await request(server)
        .post('/api/auth/login')
        .send({ identifier: 'nobody@example.com', password: 'Wrong12345' })
        .expect(401);
      expect(wrong.body).toEqual(unknown.body);
      expect(wrong.body.error.message).toBe(INVALID_CREDENTIALS_MESSAGE);
    });

    it('requires a session for /me', async () => {
      const res = await request(server).get('/api/auth/me').expect(401);
      expect(res.body.error.code).toBe('UNAUTHENTICATED');
    });

    it('accepts the access token as a Bearer header (non-browser clients)', async () => {
      const { agent } = await signupVerified();
      const login = await agent.post('/api/auth/refresh').set('Origin', ORIGIN).expect(200);
      const access = setCookies(login).get(C.access)?.value;
      await request(server).get('/api/auth/me').set('Authorization', `Bearer ${access}`).expect(200);
    });

    it('refreshes with rotation; a parallel refresh survives, a late replay kills the family', async () => {
      const agent = request.agent(server);
      const { body } = await signupVerified({ agent });
      const current = await agent.post('/api/auth/refresh').set('Origin', ORIGIN).expect(200);
      const oldRefresh = setCookies(current).get(C.refresh)?.value ?? '';

      const refreshed = await agent.post('/api/auth/refresh').set('Origin', ORIGIN).expect(200);
      expect(refreshed.body.data.email).toBe(body.email);
      expect(setCookies(refreshed).get(C.refresh)?.value).not.toBe(oldRefresh);
      await agent.get('/api/auth/me').expect(200);

      // A page and its prefetch refreshing at the same moment: the second one gets its own pair.
      const replay = () => request(server).post('/api/auth/refresh').set('Origin', ORIGIN).set('Cookie', `${C.refresh}=${oldRefresh}`);
      await replay().expect(200);

      // The same replay after the grace period is theft: refused, cookie cleared, every login of the
      // family ended.
      await testApp.app
        .get<Model<RefreshToken>>(getModelToken(RefreshToken.name))
        .updateOne({ tokenHash: hashToken(oldRefresh) }, { $set: { rotatedAt: new Date(Date.now() - REUSE_GRACE_MS - 1_000) } })
        .exec();
      const late = await replay().expect(401);
      expect(setCookies(late).get(C.refresh)?.value).toBe('');
      await agent.post('/api/auth/refresh').set('Origin', ORIGIN).expect(401);
    });

    it('logs out: cookies are cleared and the refresh token is revoked', async () => {
      const agent = request.agent(server);
      const { body } = signup();
      await signupVerified({ agent, overrides: body });
      const session = await agent.post('/api/auth/refresh').set('Origin', ORIGIN).expect(200);
      const refresh = setCookies(session).get(C.refresh)?.value;

      const out = await agent.post('/api/auth/logout').set('Origin', ORIGIN).expect(204);
      expect(setCookies(out).get(C.access)?.value).toBe('');
      await request(server)
        .post('/api/auth/refresh')
        .set('Origin', ORIGIN)
        .set('Cookie', `${C.refresh}=${refresh}`)
        .expect(401);
    });

    it('refuses the access token of a logged-out session at once', async () => {
      const { body } = await signupVerified();
      const login = await request(server)
        .post('/api/auth/login')
        .set('Origin', ORIGIN)
        .send({ identifier: body.email, password: PASSWORD })
        .expect(200);
      const access = setCookies(login).get(C.access)?.value;
      const refresh = setCookies(login).get(C.refresh)?.value;
      const me = () => request(server).get('/api/auth/me').set('Cookie', `${C.access}=${access}`);

      await me().expect(200);
      await request(server).post('/api/auth/logout').set('Origin', ORIGIN).set('Cookie', `${C.refresh}=${refresh}`).expect(204);
      await me().expect(401);
    });

    it('refuses older access tokens after a password change, keeping the changing device signed in', async () => {
      const { agent, body } = await signupVerified();
      const other = await request(server)
        .post('/api/auth/login')
        .set('Origin', ORIGIN)
        .send({ identifier: body.email, password: PASSWORD })
        .expect(200);
      const otherAccess = setCookies(other).get(C.access)?.value;
      await agent.get('/api/auth/me').expect(200);
      await sleep(1100); // `iat` has one-second resolution

      await agent
        .post('/api/account/change-password')
        .set('Origin', ORIGIN)
        .send({ currentPassword: PASSWORD, newPassword: 'Plaster2027' })
        .expect(204);

      await request(server).get('/api/auth/me').set('Cookie', `${C.access}=${otherAccess}`).expect(401);
      // This device's old access token is refused too; its refresh token still works.
      await agent.get('/api/auth/me').expect(401);
      await agent.post('/api/auth/refresh').set('Origin', ORIGIN).expect(200);
      await agent.get('/api/auth/me').expect(200);
    });

    it('locks a blocked customer out immediately, session and login alike', async () => {
      const { agent, body, created } = await signupVerified();

      const users = testApp.app.get<Model<User>>(getModelToken(User.name));
      await users.updateOne({ email: body.email }, { $set: { status: 'blocked' } });
      // What the block endpoint will do: drop the cached view so the next request sees it.
      testApp.app.get(AuthUserCache).invalidate(String(created.body.data.id));

      const me = await agent.get('/api/auth/me').expect(403);
      expect(me.body.error.code).toBe('ACCOUNT_BLOCKED');
      const login = await request(server).post('/api/auth/login').send({ identifier: body.email, password: PASSWORD }).expect(403);
      expect(login.body.error.code).toBe('ACCOUNT_BLOCKED');
    });
  });

  describe('forgot and reset password', () => {
    it('answers the same whether or not the email exists, and only emails real customers', async () => {
      const before = sent.filter((entry) => entry.event === 'auth.password_reset').length;
      const res = await request(server)
        .post('/api/auth/forgot-password')
        .send({ email: 'nobody@example.com' })
        .expect(200);
      expect(res.body.data.message).toBe(FORGOT_PASSWORD_MESSAGE);
      expect(sent.filter((entry) => entry.event === 'auth.password_reset')).toHaveLength(before);
    });

    it('resets with a single-use link and signs the customer out everywhere', async () => {
      const agent = request.agent(server);
      const { body } = await signupVerified({ agent });
      const session = await agent.post('/api/auth/refresh').set('Origin', ORIGIN).expect(200);
      const oldRefresh = setCookies(session).get(C.refresh)?.value;
      const oldAccess = setCookies(session).get(C.access)?.value;
      await sleep(1100); // `iat` has one-second resolution

      await request(server).post('/api/auth/forgot-password').send({ email: body.email }).expect(200);
      const token = emailedToken(body.email, 'auth.password_reset');
      expect(token).toMatch(/^[A-Za-z0-9_-]{43}$/);

      await request(server).post('/api/auth/reset-password').send({ token, password: 'NewCement2027' }).expect(204);

      await request(server).post('/api/auth/login').send({ identifier: body.email, password: PASSWORD }).expect(401);
      await request(server).post('/api/auth/login').send({ identifier: body.email, password: 'NewCement2027' }).expect(200);

      const again = await request(server).post('/api/auth/reset-password').send({ token, password: 'Another2028' }).expect(400);
      expect(again.body.error.code).toBe('VALIDATION_ERROR');

      await request(server)
        .post('/api/auth/refresh')
        .set('Origin', ORIGIN)
        .set('Cookie', `${C.refresh}=${oldRefresh}`)
        .expect(401);
      await request(server).get('/api/auth/me').set('Cookie', `${C.access}=${oldAccess}`).expect(401);
    });

    it('does not email a reset link for a deleted account', async () => {
      const { body } = await signupVerified();
      await testApp.app
        .get<Model<User>>(getModelToken(User.name))
        .updateOne({ email: body.email }, { $set: { deletedAt: new Date() } });
      const before = sent.length;
      await request(server).post('/api/auth/forgot-password').send({ email: body.email }).expect(200);
      expect(sent.slice(before).some((entry) => entry.event === 'auth.password_reset')).toBe(false);
    });
  });

  describe('staff login', () => {
    it('returns the admin with every permission', async () => {
      const { res } = await staffAgent({ role: 'ADMIN' });
      expect(res.body.data.user.role).toBe('ADMIN');
      expect(res.body.data.permissions).toEqual([...PERMISSION_KEYS]);
      expect(setCookies(res).get(A.access)).toBeDefined();
      expect(setCookies(res).get(C.access)).toBeUndefined();
    });

    it('keeps customers and staff out of each other’s logins', async () => {
      const { body } = signup();
      await request(server).post('/api/auth/signup').set('Origin', ORIGIN).send(body).expect(201);
      const customerOnAdmin = await request(server)
        .post('/api/admin/auth/login')
        .send({ email: body.email, password: PASSWORD })
        .expect(401);
      expect(customerOnAdmin.body.error.message).toBe(INVALID_CREDENTIALS_MESSAGE);

      const staff = await createStaff(testApp.app);
      await request(server).post('/api/auth/login').send({ identifier: staff.email, password: PASSWORD }).expect(401);
    });

    it('never accepts a customer token on the admin API, even under the admin cookie name', async () => {
      const { agent } = await signupVerified();
      const session = await agent.post('/api/auth/refresh').set('Origin', ORIGIN).expect(200);
      const customerAccess = setCookies(session).get(C.access)?.value;
      await request(server).get('/api/admin/auth/me').set('Cookie', `${C.access}=${customerAccess}`).expect(401);
      await request(server).get('/api/admin/auth/me').set('Cookie', `${A.access}=${customerAccess}`).expect(401);
    });
  });

  describe('permissions (SPEC §4)', () => {
    it('lets an Order Manager do order work but not product or admin-only work', async () => {
      const { agent } = await staffAgent({ permissions: [...PERMISSION_PRESETS.orderManager.permissions] });
      await agent.get('/api/admin/probe/any').expect(200);
      const products = await agent.get('/api/admin/probe/products').expect(403);
      expect(products.body.error.code).toBe('FORBIDDEN');
      await agent.get('/api/admin/probe/settings').expect(403);
    });

    it('lets a Catalog Manager see products', async () => {
      const { agent } = await staffAgent({ permissions: [...PERMISSION_PRESETS.catalogManager.permissions] });
      await agent.get('/api/admin/probe/products').expect(200);
    });

    it('lets an admin everywhere', async () => {
      const { agent } = await staffAgent({ role: 'ADMIN' });
      await agent.get('/api/admin/probe/products').expect(200);
      await agent.get('/api/admin/probe/settings').expect(200);
    });

    it('refuses a route that declares no policy', async () => {
      const { agent } = await staffAgent({ role: 'ADMIN' });
      await agent.get('/api/forgotten').expect(403);
      await request(server).get('/api/forgotten').expect(403);
    });
  });

  describe('forced password change (SPEC §6.11)', () => {
    it('limits the staff member to /api/admin/auth/* until they set a new password', async () => {
      const { agent, res } = await staffAgent({ mustChangePassword: true, permissions: ['orders.view'] });
      expect(res.body.data.mustChangePassword).toBe(true);

      await agent.get('/api/admin/auth/me').expect(200);
      const blocked = await agent.get('/api/admin/probe/any').expect(403);
      expect(blocked.body.error.details).toEqual({ reason: 'PASSWORD_CHANGE_REQUIRED' });

      const wrongCurrent = await agent
        .post('/api/admin/auth/change-password')
        .set('Origin', ORIGIN)
        .send({ currentPassword: 'Wrong12345', newPassword: 'Fresh2027x' })
        .expect(400);
      expect(wrongCurrent.body.error.details[0].path).toBe('currentPassword');

      await agent
        .post('/api/admin/auth/change-password')
        .set('Origin', ORIGIN)
        .send({ currentPassword: PASSWORD, newPassword: PASSWORD })
        .expect(400);

      const changed = await agent
        .post('/api/admin/auth/change-password')
        .set('Origin', ORIGIN)
        .send({ currentPassword: PASSWORD, newPassword: 'Fresh2027x' })
        .expect(200);
      expect(changed.body.data.mustChangePassword).toBe(false);
      // Older access tokens are refused after a password change; this login's refresh token still works.
      await agent.post('/api/admin/auth/refresh').set('Origin', ORIGIN).expect(200);
      await agent.get('/api/admin/probe/any').expect(200);
    });
  });
});
