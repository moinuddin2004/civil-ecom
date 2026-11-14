import type { StaffDTO, TemporaryPasswordDTO } from '@aricon/shared';
import mongoose from 'mongoose';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { AuditLog } from '../src/models/audit-log.model.js';
import { Order } from '../src/models/order.model.js';
import { Settings, SETTINGS_ID } from '../src/models/settings.model.js';
import { User } from '../src/models/user.model.js';
import { EMAIL_NOT_VERIFIED_MESSAGE } from '../src/modules/auth/email-verification.error.js';
import { NotificationsService, type NotificationEvent } from '../src/modules/notifications/notifications.service.js';
import { createStaff, ORIGIN, PASSWORD, uniqueContact } from './utils/auth.js';
import {
  createArea,
  createCatalogBasics,
  createProduct,
  customerAgent,
  modelOf,
  placeOrder,
  staffAgent,
  type Agent,
} from './utils/fixtures.js';
import { createTestApp, type TestApp } from './utils/test-app.js';

/** Staff and customers (SPEC §4.5, §6.11, §7.3; Phase 2b MUST: last-admin guard, dependencies, audit). */
describe('Admin staff and customers', () => {
  let testApp: TestApp;
  let server: Parameters<typeof request>[0];
  let admin: Agent;
  let adminId: string;
  const sent: { event: NotificationEvent; payload: Record<string, unknown> }[] = [];

  beforeAll(async () => {
    testApp = await createTestApp();
    server = testApp.app.getHttpServer() as Parameters<typeof request>[0];
    ({ agent: admin, id: adminId } = await staffAgent(testApp.app, {
      role: 'ADMIN',
    }));
    vi.spyOn(testApp.app.get(NotificationsService), 'notify').mockImplementation(async (event, payload) => {
      sent.push({ event, payload: payload as Record<string, unknown> });
    });
  });

  afterAll(async () => {
    await testApp?.close();
  });

  /** The newest verification link sent to an address. */
  function verificationToken(email: string): string {
    for (let index = sent.length - 1; index >= 0; index -= 1) {
      const entry = sent[index];
      if (entry?.event !== 'auth.verify_email' || entry.payload.to !== email) continue;
      return new URL(entry.payload.verifyUrl as string).searchParams.get('token') ?? '';
    }
    throw new Error(`No verification email was sent to ${email}.`);
  }

  async function verifyEmail(email: string): Promise<void> {
    await request(server)
      .post('/api/auth/verify-email')
      .send({ token: verificationToken(email) })
      .expect(204);
  }

  const audit = () => modelOf<AuditLog>(testApp.app, AuditLog.name);
  const patch = (id: string, body: object) =>
    admin.patch(`/api/admin/staff/${id}`).set('Origin', ORIGIN).send(body);

  it('creates staff with dependencies applied and a one-time temporary password', async () => {
    const res = await admin
      .post('/api/admin/staff')
      .set('Origin', ORIGIN)
      .send({
        name: 'Sana Malik',
        email: 'Sana@Aricon.test',
        role: 'STAFF',
        permissions: ['orders.cancel', 'customers.export'],
      })
      .expect(201);
    const { staff, temporaryPassword } = res.body.data as TemporaryPasswordDTO;
    expect(staff).toMatchObject({
      email: 'sana@aricon.test',
      mustChangePassword: true,
    });
    expect(staff.permissions).toEqual([
      'orders.view',
      'orders.cancel',
      'customers.view',
      'customers.export',
    ]);
    expect(temporaryPassword).toMatch(/^[A-Za-z0-9]{12}$/);
    expect(
      sent.some((entry) => entry.event === 'auth.verify_email' && entry.payload.to === 'sana@aricon.test'),
    ).toBe(true);

    // The password cannot be used until the emailed address is verified.
    const agent = request.agent(server);
    const blocked = await agent
      .post('/api/admin/auth/login')
      .set('Origin', ORIGIN)
      .send({ email: 'sana@aricon.test', password: temporaryPassword })
      .expect(403);
    expect(blocked.body.error).toMatchObject({
      code: 'EMAIL_NOT_VERIFIED',
      message: EMAIL_NOT_VERIFIED_MESSAGE,
      details: { email: 'sana@aricon.test', canResend: true },
    });
    await verifyEmail('sana@aricon.test');

    // The password works once, and only for the password change.
    const login = await agent
      .post('/api/admin/auth/login')
      .set('Origin', ORIGIN)
      .send({ email: 'sana@aricon.test', password: temporaryPassword })
      .expect(200);
    expect(login.body.data.mustChangePassword).toBe(true);
    await agent.get('/api/admin/orders').expect(403);

    // Never stored or logged in plain text: only in this response.
    const entry = await audit()
      .findOne({ action: 'user.created', entityId: staff.id })
      .lean()
      .exec();
    expect(JSON.stringify(entry)).not.toContain(temporaryPassword);

    await admin
      .post('/api/admin/staff')
      .set('Origin', ORIGIN)
      .send({ name: 'Dup', email: 'sana@aricon.test', role: 'STAFF' })
      .expect(409);
    await admin
      .post('/api/admin/staff')
      .set('Origin', ORIGIN)
      .send({
        name: 'Bad',
        email: 'bad@aricon.test',
        role: 'STAFF',
        permissions: ['orders.fly'],
      })
      .expect(400);
  });

  it('a customer email can never become staff', async () => {
    const { email } = await customerAgent(testApp.app);
    const res = await admin
      .post('/api/admin/staff')
      .set('Origin', ORIGIN)
      .send({ name: 'Customer', email, role: 'STAFF' })
      .expect(409);
    expect(res.body.error.code).toBe('EMAIL_TAKEN');
  });

  it('permission changes are saved with dependencies and audited with before/after', async () => {
    const { id } = await staffAgent(testApp.app, {
      permissions: ['orders.view'],
    });
    const updated = (
      await patch(id, { permissions: ['products.edit_price'] }).expect(200)
    ).body.data as StaffDTO;
    // SPEC §4.2: edit_price depends on products.view (not products.edit).
    expect(updated.permissions).toEqual([
      'products.view',
      'products.edit_price',
    ]);

    const entry = await audit()
      .findOne({ action: 'user.permissions_changed', entityId: id })
      .lean()
      .exec();
    expect(entry).toMatchObject({
      before: { permissions: ['orders.view'] },
      after: { permissions: ['products.view', 'products.edit_price'] },
    });
  });

  it('an admin cannot demote or block themselves', async () => {
    const self = await patch(adminId, { role: 'STAFF' }).expect(409);
    expect(self.body.error.message).toMatch(/your own role/);
    await patch(adminId, { status: 'blocked' }).expect(409);
  });

  it('two admins demoting each other at the same moment still leave one active admin', async () => {
    const a = await staffAgent(testApp.app, { role: 'ADMIN' });
    const b = await staffAgent(testApp.app, { role: 'ADMIN' });
    // Make A and B the only active admins.
    await modelOf<User>(testApp.app, User.name)
      .updateMany(
        {
          role: 'ADMIN',
          email: mongoose.trusted({ $nin: [a.email, b.email] }),
        },
        { $set: { role: 'STAFF' } },
      )
      .exec();

    const results = await Promise.all([
      a.agent
        .patch(`/api/admin/staff/${b.id}`)
        .set('Origin', ORIGIN)
        .send({ role: 'STAFF' }),
      b.agent
        .patch(`/api/admin/staff/${a.id}`)
        .set('Origin', ORIGIN)
        .send({ role: 'STAFF' }),
    ]);
    expect(results.map((res) => res.status).sort((x, y) => x - y)).toEqual([
      200, 409,
    ]);
    expect(
      results.find((res) => res.status === 409)?.body.error.message,
    ).toMatch(/at least one active admin/);
    expect(
      await modelOf<User>(testApp.app, User.name).countDocuments({
        role: 'ADMIN',
        status: 'active',
      }),
    ).toBe(1);

    // Restore the suite's admin for the tests below.
    await modelOf<User>(testApp.app, User.name)
      .updateOne({ _id: adminId }, { $set: { role: 'ADMIN' } })
      .exec();
  });

  it('blocking a staff member signs them out at once', async () => {
    const victim = await staffAgent(testApp.app, {
      permissions: ['orders.view'],
    });
    await victim.agent.get('/api/admin/orders').expect(200);
    await patch(victim.id, { status: 'blocked' }).expect(200);
    // SPEC §6.11: a blocked account is told so (403 ACCOUNT_BLOCKED) and can't refresh either.
    expect(
      (await victim.agent.get('/api/admin/orders').expect(403)).body.error.code,
    ).toBe('ACCOUNT_BLOCKED');
    await victim.agent
      .post('/api/admin/auth/refresh')
      .set('Origin', ORIGIN)
      .expect(401);
    expect(
      await audit().countDocuments({
        action: 'user.blocked',
        entityId: victim.id,
      }),
    ).toBe(1);
  });

  it('a password reset forces a change and ends their sessions', async () => {
    const member = await staffAgent(testApp.app, {
      permissions: ['orders.view'],
    });
    const { temporaryPassword } = (
      await admin
        .post(`/api/admin/staff/${member.id}/reset-password`)
        .set('Origin', ORIGIN)
        .expect(200)
    ).body.data as TemporaryPasswordDTO;
    await member.agent
      .post('/api/admin/auth/refresh')
      .set('Origin', ORIGIN)
      .expect(401);
    const login = await request(server)
      .post('/api/admin/auth/login')
      .set('Origin', ORIGIN)
      .send({ email: member.email, password: temporaryPassword })
      .expect(200);
    expect(login.body.data.mustChangePassword).toBe(true);
  });

  it('an admin can mark a staff email verified (audited); other staff cannot', async () => {
    const target = await createStaff(testApp.app, { emailVerified: false });
    const other = await staffAgent(testApp.app, { permissions: ['orders.view'] });
    const verifyUrl = `/api/admin/staff/${target.id}/verify-email`;
    const login = () =>
      request(server).post('/api/admin/auth/login').set('Origin', ORIGIN).send({ email: target.email, password: target.password });

    await other.agent.post(verifyUrl).set('Origin', ORIGIN).expect(403);
    await login().expect(403);
    expect(await audit().countDocuments({ action: 'user.email_verified', entityId: target.id })).toBe(0);

    const res = await admin.post(verifyUrl).set('Origin', ORIGIN).expect(200);
    expect(res.body.data).toMatchObject({ id: target.id, emailVerified: true });
    const entry = await audit().findOne({ action: 'user.email_verified', entityId: target.id }).lean().exec();
    expect(entry).toMatchObject({ entity: 'user', before: { emailVerified: false }, after: { emailVerified: true } });
    await login().expect(200);

    // Already verified: still succeeds, but no second audit entry.
    await admin.post(verifyUrl).set('Origin', ORIGIN).expect(200);
    expect(await audit().countDocuments({ action: 'user.email_verified', entityId: target.id })).toBe(1);

    await admin.post('/api/admin/staff/665f1c2a9b1e8a0012a3b4c5/verify-email').set('Origin', ORIGIN).expect(404);
  });

  it('customers: list with stats, detail, block signs them out, unblock', async () => {
    const { agent: customer, userId } = await customerAgent(testApp.app);
    const viewer = await staffAgent(testApp.app, {
      permissions: ['customers.view'],
    });

    const list = await viewer.agent
      .get('/api/admin/customers?q=Test%20Customer')
      .expect(200);
    expect(list.body.data[0]).toMatchObject({
      orderCount: 0,
      totalSpent: 0,
      status: 'active',
    });
    expect(
      (await viewer.agent.get(`/api/admin/customers/${userId}`).expect(200))
        .body.data,
    ).toMatchObject({ addresses: [], recentOrders: [] });
    await viewer.agent
      .post(`/api/admin/customers/${userId}/block`)
      .set('Origin', ORIGIN)
      .send({})
      .expect(403);

    await customer.get('/api/auth/me').expect(200);
    const blocked = await admin
      .post(`/api/admin/customers/${userId}/block`)
      .set('Origin', ORIGIN)
      .send({ note: 'Fake orders' })
      .expect(200);
    expect(blocked.body.data.status).toBe('blocked');
    expect(
      (await customer.get('/api/auth/me').expect(403)).body.error.code,
    ).toBe('ACCOUNT_BLOCKED');
    await customer.post('/api/auth/refresh').set('Origin', ORIGIN).expect(401);
    expect(
      await audit()
        .findOne({ action: 'user.blocked', entityId: userId })
        .lean()
        .exec(),
    ).toMatchObject({
      after: { status: 'blocked', note: 'Fake orders' },
    });

    await admin
      .post(`/api/admin/customers/${userId}/unblock`)
      .set('Origin', ORIGIN)
      .send({})
      .expect(200);
    // A staff id is not a customer.
    await admin.get(`/api/admin/customers/${adminId}`).expect(404);
  });

  it('soft-deletes and restores customers without deleting their orders', async () => {
    const basics = await createCatalogBasics(testApp.app);
    const areaId = await createArea(testApp.app, {
      name: 'Customer deletion area',
      deliveryFee: 200,
    });
    const product = await createProduct(testApp.app, basics, {
      variants: [{ price: 1_000, stock: 10 }],
    });
    await modelOf<Settings>(testApp.app, Settings.name).create({
      _id: SETTINGS_ID,
      codMaxOrderAmount: 100_000,
      orderNotificationEmails: ['orders@aricon.test'],
    });
    const {
      agent: customer,
      userId,
      order,
    } = await placeOrder(testApp.app, { areaId, lines: [{ product, qty: 1 }] });
    const userBeforeDelete = await modelOf<User>(testApp.app, User.name)
      .findById(userId, { email: 1, phone: 1 })
      .lean()
      .exec();
    const email = userBeforeDelete?.email;
    const phone = userBeforeDelete?.phone;
    const viewer = await staffAgent(testApp.app, {
      permissions: ['customers.view'],
    });

    await viewer.agent
      .delete(`/api/admin/customers/${userId}`)
      .set('Origin', ORIGIN)
      .expect(403);
    const deleted = (
      await admin
        .delete(`/api/admin/customers/${userId}`)
        .set('Origin', ORIGIN)
        .expect(200)
    ).body.data as { deletedAt: string };
    expect(deleted.deletedAt).toEqual(expect.any(String));
    expect(
      (
        await modelOf<User>(testApp.app, User.name)
          .findById(userId)
          .lean()
          .exec()
      )?.deletedAt,
    ).toEqual(expect.any(Date));
    expect(
      await modelOf<Order>(testApp.app, Order.name).countDocuments({
        _id: order.id,
        userId,
      }),
    ).toBe(1);
    await customer.get('/api/auth/me').expect(401);
    await customer.post('/api/auth/refresh').set('Origin', ORIGIN).expect(401);

    const deletedList = await viewer.agent
      .get(
        `/api/admin/customers?status=deleted&q=${encodeURIComponent(email ?? '')}`,
      )
      .expect(200);
    expect(deletedList.body.data).toHaveLength(1);
    expect(deletedList.body.data[0].deletedAt).toEqual(expect.any(String));
    await viewer.agent
      .get(`/api/admin/customers?q=${encodeURIComponent(email ?? '')}`)
      .expect(200)
      .expect(({ body }) => {
        expect(body.data).toHaveLength(0);
      });

    const replacement = await request(server)
      .post('/api/auth/signup')
      .set('Origin', ORIGIN)
      .send({ name: 'Replacement Customer', email, phone, password: PASSWORD })
      .expect(201);
    const replacementId = replacement.body.data.id as string;
    expect(replacementId).not.toBe(userId);
    await verifyEmail(email ?? '');
    await request(server)
      .post('/api/auth/login')
      .set('Origin', ORIGIN)
      .send({ identifier: email, password: PASSWORD })
      .expect(200);
    expect(
      (
        await admin
          .post(`/api/admin/customers/${userId}/restore`)
          .set('Origin', ORIGIN)
          .expect(409)
      ).body.error.code,
    ).toBe('EMAIL_TAKEN');

    await admin
      .delete(`/api/admin/customers/${replacementId}`)
      .set('Origin', ORIGIN)
      .expect(200);
    const restored = (
      await admin
        .post(`/api/admin/customers/${userId}/restore`)
        .set('Origin', ORIGIN)
        .expect(200)
    ).body.data as { deletedAt: string | null };
    expect(restored.deletedAt).toBeNull();
    expect(
      await audit().countDocuments({
        action: 'user.deleted',
        entityId: userId,
      }),
    ).toBe(1);
    expect(
      await audit().countDocuments({
        action: 'user.restored',
        entityId: userId,
      }),
    ).toBe(1);
  });

  it('soft-deletes and restores staff, blocks sign-in, and prevents deleting yourself', async () => {
    await admin
      .delete(`/api/admin/staff/${adminId}`)
      .set('Origin', ORIGIN)
      .expect(409);

    const member = await staffAgent(testApp.app, {
      permissions: ['orders.view'],
    });
    await member.agent.get('/api/admin/orders').expect(200);
    const deleted = (
      await admin
        .delete(`/api/admin/staff/${member.id}`)
        .set('Origin', ORIGIN)
        .expect(200)
    ).body.data as StaffDTO;
    expect(deleted.deletedAt).toEqual(expect.any(String));
    await member.agent.get('/api/admin/orders').expect(401);
    await member.agent
      .post('/api/admin/auth/refresh')
      .set('Origin', ORIGIN)
      .expect(401);
    expect(
      await audit().countDocuments({
        action: 'user.deleted',
        entityId: member.id,
      }),
    ).toBe(1);

    const restored = (
      await admin
        .post(`/api/admin/staff/${member.id}/restore`)
        .set('Origin', ORIGIN)
        .expect(200)
    ).body.data as StaffDTO;
    expect(restored.deletedAt).toBeNull();
    expect(
      await audit().countDocuments({
        action: 'user.restored',
        entityId: member.id,
      }),
    ).toBe(1);

    const colleagueAdmin = await staffAgent(testApp.app, { role: 'ADMIN' });
    const deletedAdmin = (
      await admin
        .delete(`/api/admin/staff/${colleagueAdmin.id}`)
        .set('Origin', ORIGIN)
        .expect(200)
    ).body.data as StaffDTO;
    expect(deletedAdmin.deletedAt).toEqual(expect.any(String));
    const activeAdmins = await modelOf<User>(testApp.app, User.name)
      .find({ role: 'ADMIN', status: 'active' })
      .lean()
      .exec();
    expect(activeAdmins.some((user) => !user.deletedAt)).toBe(true);
  });

  it('allows staff creation to reuse email and phone after soft delete', async () => {
    const contact = uniqueContact();
    const input = {
      name: 'Recreated Staff',
      email: contact.email,
      phone: contact.phone,
      role: 'STAFF',
      permissions: [],
    };
    const first = (
      await admin
        .post('/api/admin/staff')
        .set('Origin', ORIGIN)
        .send(input)
        .expect(201)
    ).body.data as TemporaryPasswordDTO;
    await admin
      .delete(`/api/admin/staff/${first.staff.id}`)
      .set('Origin', ORIGIN)
      .expect(200);

    const second = (
      await admin
        .post('/api/admin/staff')
        .set('Origin', ORIGIN)
        .send(input)
        .expect(201)
    ).body.data as TemporaryPasswordDTO;
    expect(second.staff.id).not.toBe(first.staff.id);
    await verifyEmail(contact.email);
    await request(server)
      .post('/api/admin/auth/login')
      .set('Origin', ORIGIN)
      .send({ email: contact.email, password: second.temporaryPassword })
      .expect(200);
    expect(
      (
        await admin
          .post(`/api/admin/staff/${first.staff.id}/restore`)
          .set('Origin', ORIGIN)
          .expect(409)
      ).body.error.code,
    ).toBe('EMAIL_TAKEN');
  });

  it('the permission catalog is open to any staff member', async () => {
    const plain = await staffAgent(testApp.app, { permissions: [] });
    const { body } = await plain.agent
      .get('/api/admin/permissions')
      .expect(200);
    expect(
      body.data.presets.map((preset: { key: string }) => preset.key),
    ).toEqual(['orderManager', 'catalogManager', 'accountantViewer']);
    await plain.agent.get('/api/admin/staff').expect(403);
  });
});
