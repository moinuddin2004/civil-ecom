import type { StaffDTO, TemporaryPasswordDTO } from '@aricon/shared';
import mongoose from 'mongoose';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { AuditLog } from '../src/models/audit-log.model.js';
import { User } from '../src/models/user.model.js';
import { ORIGIN } from './utils/auth.js';
import { customerAgent, modelOf, staffAgent, type Agent } from './utils/fixtures.js';
import { createTestApp, type TestApp } from './utils/test-app.js';

/** Staff and customers (SPEC §4.5, §6.11, §7.3; Phase 2b MUST: last-admin guard, dependencies, audit). */
describe('Admin staff and customers', () => {
  let testApp: TestApp;
  let server: Parameters<typeof request>[0];
  let admin: Agent;
  let adminId: string;

  beforeAll(async () => {
    testApp = await createTestApp();
    server = testApp.app.getHttpServer() as Parameters<typeof request>[0];
    ({ agent: admin, id: adminId } = await staffAgent(testApp.app, { role: 'ADMIN' }));
  });

  afterAll(async () => {
    await testApp?.close();
  });

  const audit = () => modelOf<AuditLog>(testApp.app, AuditLog.name);
  const patch = (id: string, body: object) => admin.patch(`/api/admin/staff/${id}`).set('Origin', ORIGIN).send(body);

  it('creates staff with dependencies applied and a one-time temporary password', async () => {
    const res = await admin
      .post('/api/admin/staff')
      .set('Origin', ORIGIN)
      .send({ name: 'Sana Malik', email: 'Sana@Aricon.test', role: 'STAFF', permissions: ['orders.cancel', 'customers.export'] })
      .expect(201);
    const { staff, temporaryPassword } = res.body.data as TemporaryPasswordDTO;
    expect(staff).toMatchObject({ email: 'sana@aricon.test', mustChangePassword: true });
    expect(staff.permissions).toEqual(['orders.view', 'orders.cancel', 'customers.view', 'customers.export']);
    expect(temporaryPassword).toMatch(/^[A-Za-z0-9]{12}$/);

    // The password works once, and only for the password change.
    const agent = request.agent(server);
    const login = await agent.post('/api/admin/auth/login').set('Origin', ORIGIN).send({ email: 'sana@aricon.test', password: temporaryPassword }).expect(200);
    expect(login.body.data.mustChangePassword).toBe(true);
    await agent.get('/api/admin/orders').expect(403);

    // Never stored or logged in plain text: only in this response.
    const entry = await audit().findOne({ action: 'user.created', entityId: staff.id }).lean().exec();
    expect(JSON.stringify(entry)).not.toContain(temporaryPassword);

    await admin
      .post('/api/admin/staff')
      .set('Origin', ORIGIN)
      .send({ name: 'Dup', email: 'sana@aricon.test', role: 'STAFF' })
      .expect(409);
    await admin
      .post('/api/admin/staff')
      .set('Origin', ORIGIN)
      .send({ name: 'Bad', email: 'bad@aricon.test', role: 'STAFF', permissions: ['orders.fly'] })
      .expect(400);
  });

  it('a customer email can never become staff', async () => {
    const { email } = await customerAgent(testApp.app);
    const res = await admin.post('/api/admin/staff').set('Origin', ORIGIN).send({ name: 'Customer', email, role: 'STAFF' }).expect(409);
    expect(res.body.error.code).toBe('EMAIL_TAKEN');
  });

  it('permission changes are saved with dependencies and audited with before/after', async () => {
    const { id } = await staffAgent(testApp.app, { permissions: ['orders.view'] });
    const updated = (await patch(id, { permissions: ['products.edit_price'] }).expect(200)).body.data as StaffDTO;
    // SPEC §4.2: edit_price depends on products.view (not products.edit).
    expect(updated.permissions).toEqual(['products.view', 'products.edit_price']);

    const entry = await audit().findOne({ action: 'user.permissions_changed', entityId: id }).lean().exec();
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
      .updateMany({ role: 'ADMIN', email: mongoose.trusted({ $nin: [a.email, b.email] }) }, { $set: { role: 'STAFF' } })
      .exec();

    const results = await Promise.all([
      a.agent.patch(`/api/admin/staff/${b.id}`).set('Origin', ORIGIN).send({ role: 'STAFF' }),
      b.agent.patch(`/api/admin/staff/${a.id}`).set('Origin', ORIGIN).send({ role: 'STAFF' }),
    ]);
    expect(results.map((res) => res.status).sort((x, y) => x - y)).toEqual([200, 409]);
    expect(results.find((res) => res.status === 409)?.body.error.message).toMatch(/at least one active admin/);
    expect(await modelOf<User>(testApp.app, User.name).countDocuments({ role: 'ADMIN', status: 'active' })).toBe(1);

    // Restore the suite's admin for the tests below.
    await modelOf<User>(testApp.app, User.name).updateOne({ _id: adminId }, { $set: { role: 'ADMIN' } }).exec();
  });

  it('blocking a staff member signs them out at once', async () => {
    const victim = await staffAgent(testApp.app, { permissions: ['orders.view'] });
    await victim.agent.get('/api/admin/orders').expect(200);
    await patch(victim.id, { status: 'blocked' }).expect(200);
    // SPEC §6.11: a blocked account is told so (403 ACCOUNT_BLOCKED) and can't refresh either.
    expect((await victim.agent.get('/api/admin/orders').expect(403)).body.error.code).toBe('ACCOUNT_BLOCKED');
    await victim.agent.post('/api/admin/auth/refresh').set('Origin', ORIGIN).expect(401);
    expect(await audit().countDocuments({ action: 'user.blocked', entityId: victim.id })).toBe(1);
  });

  it('a password reset forces a change and ends their sessions', async () => {
    const member = await staffAgent(testApp.app, { permissions: ['orders.view'] });
    const { temporaryPassword } = (await admin.post(`/api/admin/staff/${member.id}/reset-password`).set('Origin', ORIGIN).expect(200)).body
      .data as TemporaryPasswordDTO;
    await member.agent.post('/api/admin/auth/refresh').set('Origin', ORIGIN).expect(401);
    const login = await request(server)
      .post('/api/admin/auth/login')
      .set('Origin', ORIGIN)
      .send({ email: member.email, password: temporaryPassword })
      .expect(200);
    expect(login.body.data.mustChangePassword).toBe(true);
  });

  it('customers: list with stats, detail, block signs them out, unblock', async () => {
    const { agent: customer, userId } = await customerAgent(testApp.app);
    const viewer = await staffAgent(testApp.app, { permissions: ['customers.view'] });

    const list = await viewer.agent.get('/api/admin/customers?q=Test%20Customer').expect(200);
    expect(list.body.data[0]).toMatchObject({ orderCount: 0, totalSpent: 0, status: 'active' });
    expect((await viewer.agent.get(`/api/admin/customers/${userId}`).expect(200)).body.data).toMatchObject({ addresses: [], recentOrders: [] });
    await viewer.agent.post(`/api/admin/customers/${userId}/block`).set('Origin', ORIGIN).send({}).expect(403);

    await customer.get('/api/auth/me').expect(200);
    const blocked = await admin.post(`/api/admin/customers/${userId}/block`).set('Origin', ORIGIN).send({ note: 'Fake orders' }).expect(200);
    expect(blocked.body.data.status).toBe('blocked');
    expect((await customer.get('/api/auth/me').expect(403)).body.error.code).toBe('ACCOUNT_BLOCKED');
    await customer.post('/api/auth/refresh').set('Origin', ORIGIN).expect(401);
    expect(await audit().findOne({ action: 'user.blocked', entityId: userId }).lean().exec()).toMatchObject({
      after: { status: 'blocked', note: 'Fake orders' },
    });

    await admin.post(`/api/admin/customers/${userId}/unblock`).set('Origin', ORIGIN).send({}).expect(200);
    // A staff id is not a customer.
    await admin.get(`/api/admin/customers/${adminId}`).expect(404);
  });

  it('the permission catalog is open to any staff member', async () => {
    const plain = await staffAgent(testApp.app, { permissions: [] });
    const { body } = await plain.agent.get('/api/admin/permissions').expect(200);
    expect(body.data.presets.map((preset: { key: string }) => preset.key)).toEqual(['orderManager', 'catalogManager', 'accountantViewer']);
    await plain.agent.get('/api/admin/staff').expect(403);
  });
});
