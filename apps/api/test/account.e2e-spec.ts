import { AUTH_COOKIES, type AddressDTO } from '@aricon/shared';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { ORIGIN, PASSWORD, setCookies } from './utils/auth.js';
import { createArea, customerAgent } from './utils/fixtures.js';
import { createTestApp, type TestApp } from './utils/test-app.js';

/** Customer account (SPEC §7.2 "Account"): profile, password and saved addresses. */
describe('Account', () => {
  let testApp: TestApp;
  let server: Parameters<typeof request>[0];
  let gulshan: string;
  let gadap: string;

  beforeAll(async () => {
    testApp = await createTestApp();
    server = testApp.app.getHttpServer() as Parameters<typeof request>[0];
    gulshan = await createArea(testApp.app, { name: 'Gulshan-e-Iqbal' });
    gadap = await createArea(testApp.app, { name: 'Gadap', isServiceable: false });
  });

  afterAll(async () => {
    await testApp?.close();
  });

  const address = (label: string, overrides: Record<string, unknown> = {}) => ({
    label,
    contactName: 'Ahmed Raza',
    phone: '0300 1234567',
    line1: 'Plot 12, Block 5',
    areaId: gulshan,
    ...overrides,
  });

  it('requires a customer session', async () => {
    await request(server).get('/api/account/addresses').expect(401);
    await request(server).patch('/api/account/profile').set('Origin', ORIGIN).send({}).expect(401);
  });

  describe('profile', () => {
    it('updates name, phone and company; null clears the company', async () => {
      const { agent } = await customerAgent(testApp.app);
      const patch = (body: object) => agent.patch('/api/account/profile').set('Origin', ORIGIN).send(body);

      const { body } = await patch({ name: '  Bilal Khan ', phone: '0321-7654321', companyName: 'Khan Builders' }).expect(200);
      expect(body.data).toMatchObject({ name: 'Bilal Khan', phone: '+923217654321', companyName: 'Khan Builders' });

      expect((await patch({ name: 'Bilal Khan', phone: '03217654321' }).expect(200)).body.data.companyName).toBe('Khan Builders');
      expect((await patch({ name: 'Bilal Khan', phone: '03217654321', companyName: null }).expect(200)).body.data.companyName).toBeNull();
      expect((await agent.get('/api/auth/me').expect(200)).body.data.name).toBe('Bilal Khan');
    });

    it("refuses another account's phone, email changes and bad input", async () => {
      const first = await customerAgent(testApp.app);
      const second = await customerAgent(testApp.app);
      await first.agent.patch('/api/account/profile').set('Origin', ORIGIN).send({ name: 'First', phone: '03001112233' }).expect(200);

      const taken = await second.agent
        .patch('/api/account/profile')
        .set('Origin', ORIGIN)
        .send({ name: 'Second', phone: '+923001112233' })
        .expect(409);
      expect(taken.body.error.code).toBe('PHONE_TAKEN');

      const bad = await second.agent
        .patch('/api/account/profile')
        .set('Origin', ORIGIN)
        .send({ name: 'S', phone: '123', email: 'new@example.com' })
        .expect(400);
      expect(bad.body.error.details.map((issue: { path: string }) => issue.path).sort()).toEqual(['email', 'name', 'phone']);
    });
  });

  describe('change password', () => {
    it('keeps this device signed in and signs out the others', async () => {
      const { agent, email } = await customerAgent(testApp.app);
      const other = request.agent(server);
      await other.post('/api/auth/login').set('Origin', ORIGIN).send({ identifier: email, password: PASSWORD }).expect(200);

      await agent
        .post('/api/account/change-password')
        .set('Origin', ORIGIN)
        .send({ currentPassword: PASSWORD, newPassword: 'Plaster2027' })
        .expect(204);

      await agent.post('/api/auth/refresh').set('Origin', ORIGIN).expect(200);
      const refused = await other.post('/api/auth/refresh').set('Origin', ORIGIN).expect(401);
      expect(setCookies(refused).get(AUTH_COOKIES.customer.refresh)?.value).toBe('');

      await request(server).post('/api/auth/login').set('Origin', ORIGIN).send({ identifier: email, password: PASSWORD }).expect(401);
      await request(server)
        .post('/api/auth/login')
        .set('Origin', ORIGIN)
        .send({ identifier: email, password: 'Plaster2027' })
        .expect(200);
    });

    it('needs the right current password and a different new one', async () => {
      const { agent } = await customerAgent(testApp.app);
      const change = (body: object) => agent.post('/api/account/change-password').set('Origin', ORIGIN).send(body);

      expect((await change({ currentPassword: 'Wrong1234', newPassword: 'Plaster2027' }).expect(400)).body.error.details).toEqual([
        { path: 'currentPassword', message: 'Your current password is not right.' },
      ]);
      expect((await change({ currentPassword: PASSWORD, newPassword: PASSWORD }).expect(400)).body.error.details[0].path).toBe(
        'newPassword',
      );
      expect((await change({ currentPassword: PASSWORD, newPassword: 'short' }).expect(400)).body.error.code).toBe('VALIDATION_ERROR');
    });
  });

  describe('addresses', () => {
    it('adds, edits, sets the default and deletes, keeping exactly one default', async () => {
      const { agent } = await customerAgent(testApp.app);
      const send = (method: 'post' | 'patch' | 'delete', path: string, body?: object) =>
        agent[method](`/api/account/addresses${path}`).set('Origin', ORIGIN).send(body);
      const defaults = (list: AddressDTO[]) => list.filter((item) => item.isDefault).map((item) => item.label);

      let list = (await send('post', '', address('Home')).expect(201)).body.data as AddressDTO[];
      expect(list[0]).toMatchObject({
        label: 'Home',
        phone: '+923001234567',
        city: 'Karachi',
        areaName: 'Gulshan-e-Iqbal',
        areaServiceable: true,
        line2: null,
        isDefault: true,
      });

      list = (await send('post', '', address('Site', { areaId: gadap, isDefault: true })).expect(201)).body.data;
      expect(defaults(list)).toEqual(['Site']);
      expect(list[1]).toMatchObject({ areaName: 'Gadap', areaServiceable: false });

      const [home, site] = list as [AddressDTO, AddressDTO];
      list = (await send('patch', `/${home.id}`, address('Home office', { landmark: 'Near the park' })).expect(200)).body.data;
      expect(list[0]).toMatchObject({ id: home.id, label: 'Home office', landmark: 'Near the park', isDefault: false });

      list = (await send('post', `/${home.id}/default`).expect(200)).body.data;
      expect(defaults(list)).toEqual(['Home office']);

      list = (await send('delete', `/${home.id}`).expect(200)).body.data;
      expect(list.map((item) => [item.id, item.isDefault])).toEqual([[site.id, true]]);

      expect((await agent.get('/api/account/addresses').expect(200)).body.data).toEqual(list);
    });

    it('validates the address and the area', async () => {
      const { agent } = await customerAgent(testApp.app);
      const post = (body: object) => agent.post('/api/account/addresses').set('Origin', ORIGIN).send(body);

      const bad = await post({ ...address(''), line1: 'ab', phone: '12', areaId: 'nope' }).expect(400);
      expect(bad.body.error.details.map((issue: { path: string }) => issue.path).sort()).toEqual([
        'areaId',
        'label',
        'line1',
        'phone',
      ]);

      const unknownArea = await post(address('Home', { areaId: '0123456789abcdef01234567' })).expect(400);
      expect(unknownArea.body.error.details).toEqual([{ path: 'areaId', message: 'Choose a delivery area from the list.' }]);
    });

    it("answers 404 for an address that isn't yours", async () => {
      const owner = await customerAgent(testApp.app);
      const stranger = await customerAgent(testApp.app);
      const [mine] = (await owner.agent.post('/api/account/addresses').set('Origin', ORIGIN).send(address('Mine')).expect(201)).body
        .data as AddressDTO[];

      await stranger.agent.patch(`/api/account/addresses/${mine?.id}`).set('Origin', ORIGIN).send(address('Hijack')).expect(404);
      await stranger.agent.delete(`/api/account/addresses/${mine?.id}`).set('Origin', ORIGIN).expect(404);
      await stranger.agent.delete('/api/account/addresses/not-an-id').set('Origin', ORIGIN).expect(404);
    });
  });
});
