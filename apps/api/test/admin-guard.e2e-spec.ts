import type { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { ORIGIN } from './utils/auth.js';
import { staffAgent, type Agent } from './utils/fixtures.js';
import { createTestApp, type TestApp } from './utils/test-app.js';

/**
 * Route walk (SPEC §17 Phase 2b MUST, §16): every `/api/admin/*` route that exists — found from the
 * live router, so a newly added route is covered automatically — refuses anonymous callers (401) and
 * a staff member without permissions (403), except the few any signed-in staff may use.
 */

interface RouteLayer {
  route?: { path: string; methods: Record<string, boolean> };
}

function adminRoutes(app: INestApplication): { method: string; path: string }[] {
  const express = app.getHttpAdapter().getInstance() as unknown as { router: { stack: RouteLayer[] } };
  return express.router.stack
    .flatMap((layer) => (layer.route ? Object.keys(layer.route.methods).map((method) => ({ method, path: layer.route!.path })) : []))
    .filter((route) => route.path.startsWith('/api/admin/'));
}

/** A concrete URL for a route pattern (ids that exist nowhere: the guard must answer first). */
const concrete = (path: string) =>
  path
    .replace(':orderNumber', 'ARC-2026-000001')
    .replace(/:[A-Za-z]+/g, '0123456789abcdef01234567');

const PUBLIC = new Set(['POST /api/admin/auth/login', 'POST /api/admin/auth/refresh', 'POST /api/admin/auth/logout']);
const ANY_STAFF = new Set([
  'GET /api/admin/auth/me',
  'POST /api/admin/auth/change-password',
  'GET /api/admin/dashboard',
  'GET /api/admin/permissions',
]);

describe('Admin route walk', () => {
  let testApp: TestApp;
  let server: Parameters<typeof request>[0];
  let routes: { method: string; path: string }[];
  let noPermissions: Agent;

  beforeAll(async () => {
    testApp = await createTestApp();
    server = testApp.app.getHttpServer() as Parameters<typeof request>[0];
    routes = adminRoutes(testApp.app);
    ({ agent: noPermissions } = await staffAgent(testApp.app, { role: 'STAFF', permissions: [] }));
  });

  afterAll(async () => {
    await testApp?.close();
  });

  const call = (agent: Agent, method: string, path: string) => {
    const url = concrete(path);
    const req =
      method === 'get'
        ? agent.get(url)
        : method === 'post'
          ? agent.post(url)
          : method === 'put'
            ? agent.put(url)
            : method === 'patch'
              ? agent.patch(url)
              : agent.delete(url);
    return req.set('Origin', ORIGIN).send({});
  };

  it('finds the admin routes', () => {
    // Sanity check that the walk sees the app (a broken lookup would make the tests below vacuous).
    expect(routes.length).toBeGreaterThan(40);
    expect(routes).toContainEqual({ method: 'patch', path: '/api/admin/products/:id' });
  });

  it('refuses anonymous callers on every admin route', async () => {
    const failures: string[] = [];
    for (const { method, path } of routes) {
      const key = `${method.toUpperCase()} ${path}`;
      if (PUBLIC.has(key)) continue;
      const res = await call(request(server), method, path);
      if (res.status !== 401) failures.push(`${key} → ${res.status}`);
    }
    expect(failures).toEqual([]);
  });

  it('refuses a staff member without permissions everywhere but their own account and the dashboard', async () => {
    const failures: string[] = [];
    for (const { method, path } of routes) {
      const key = `${method.toUpperCase()} ${path}`;
      if (PUBLIC.has(key) || ANY_STAFF.has(key)) continue;
      const res = await call(noPermissions, method, path);
      if (res.status !== 403) failures.push(`${key} → ${res.status}`);
    }
    expect(failures).toEqual([]);
  });

  it('shows a staff member without permissions an empty dashboard', async () => {
    const { body } = await noPermissions.get('/api/admin/dashboard').expect(200);
    expect(body.data).toEqual({});
  });
});
