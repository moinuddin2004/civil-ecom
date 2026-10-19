import { Body, Controller, Get, Post, Query } from '@nestjs/common';
import { Type } from 'class-transformer';
import { IsArray, IsInt, IsString, Min, MinLength, ValidateNested } from 'class-validator';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { AppError } from '../src/common/errors/app-error.js';
import { Paginated } from '../src/common/http/envelope.js';
import { PaginationQueryDto } from '../src/common/http/pagination.dto.js';
import { Public } from '../src/modules/auth/auth.decorators.js';
import { createTestApp, type TestApp } from './utils/test-app.js';

/*
 * The cross-cutting stack every endpoint inherits: security headers, request ids, the response
 * envelope, validation, error mapping and the Origin check. A probe controller stands in for real
 * features so these rules are tested once, here, end to end.
 */

class ProbeItemDto {
  @IsInt({ message: 'Use a whole number.' })
  @Min(1, { message: 'Quantity must be at least 1.' })
  qty!: number;
}

class ProbeBodyDto {
  @IsString()
  @MinLength(2, { message: 'Enter at least 2 characters.' })
  name!: string;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ProbeItemDto)
  items!: ProbeItemDto[];
}

@Public()
@Controller('probe')
class ProbeController {
  @Get('item')
  item() {
    return { ok: true };
  }

  @Get('list')
  list(@Query() query: PaginationQueryDto) {
    return new Paginated(['a', 'b'], { page: query.page, pageSize: query.pageSize, total: 2 });
  }

  @Post('echo')
  echo(@Body() body: ProbeBodyDto) {
    return body;
  }

  @Get('missing')
  missing() {
    throw AppError.notFound('Nothing here.');
  }

  @Get('boom')
  boom() {
    throw new Error('secret driver detail');
  }
}

const ORIGIN = 'http://localhost:3000';

describe('API foundation', () => {
  let testApp: TestApp;
  let http: ReturnType<typeof request>;

  beforeAll(async () => {
    testApp = await createTestApp({ controllers: [ProbeController] });
    http = request(testApp.app.getHttpServer());
  });

  afterAll(async () => {
    await testApp?.close();
  });

  describe('GET /api/health', () => {
    it('answers with the literal body from the spec (no envelope) while the database is up', async () => {
      const res = await http.get('/api/health').expect(200);
      expect(res.body).toEqual({ status: 'ok', db: 'ok' });
    });
  });

  describe('HTTP hardening', () => {
    it('sends security headers and hides the framework', async () => {
      const res = await http.get('/api/health');
      expect(res.headers['x-content-type-options']).toBe('nosniff');
      expect(res.headers['x-powered-by']).toBeUndefined();
    });

    it('gives every response a request id, reusing a well-formed incoming one', async () => {
      const generated = await http.get('/api/probe/item');
      expect(generated.headers['x-request-id']).toMatch(/^[0-9a-f-]{36}$/);
      const reused = await http.get('/api/probe/item').set('x-request-id', 'support-ticket-1234');
      expect(reused.headers['x-request-id']).toBe('support-ticket-1234');
    });
  });

  describe('response envelope', () => {
    it('wraps a value in { data }', async () => {
      const res = await http.get('/api/probe/item').expect(200);
      expect(res.body).toEqual({ data: { ok: true } });
    });

    it('wraps a page in { data, meta } with pagination defaults', async () => {
      const res = await http.get('/api/probe/list').expect(200);
      expect(res.body).toEqual({ data: ['a', 'b'], meta: { page: 1, pageSize: 20, total: 2 } });
    });
  });

  describe('validation', () => {
    it('rejects a page size above 100', async () => {
      const res = await http.get('/api/probe/list?pageSize=500').expect(400);
      expect(res.body.error.code).toBe('VALIDATION_ERROR');
      expect(res.body.error.details).toContainEqual({ path: 'pageSize', message: 'Page size can be at most 100.' });
    });

    it('accepts a valid body and returns it enveloped', async () => {
      const body = { name: 'Cement', items: [{ qty: 3 }] };
      const res = await http.post('/api/probe/echo').set('Origin', ORIGIN).send(body).expect(201);
      expect(res.body).toEqual({ data: body });
    });

    it('reports nested field errors with dotted paths', async () => {
      const res = await http
        .post('/api/probe/echo')
        .set('Origin', ORIGIN)
        .send({ name: 'C', items: [{ qty: 0 }] })
        .expect(400);
      expect(res.body.error.details).toEqual(
        expect.arrayContaining([
          { path: 'name', message: 'Enter at least 2 characters.' },
          { path: 'items.0.qty', message: 'Quantity must be at least 1.' },
        ]),
      );
    });

    it('rejects unknown fields instead of silently dropping them', async () => {
      const res = await http
        .post('/api/probe/echo')
        .set('Origin', ORIGIN)
        .send({ name: 'Cement', items: [], role: 'ADMIN' })
        .expect(400);
      expect(res.body.error.details).toContainEqual({ path: 'role', message: "This field isn't allowed." });
    });

    it('answers invalid JSON with the API error shape', async () => {
      const res = await http
        .post('/api/probe/echo')
        .set('Origin', ORIGIN)
        .set('Content-Type', 'application/json')
        .send('{"name": ')
        .expect(400);
      expect(res.body).toEqual({ error: { code: 'VALIDATION_ERROR', message: 'The request body is not valid JSON.' } });
    });
  });

  describe('errors', () => {
    it('answers an unknown route with NOT_FOUND', async () => {
      const res = await http.get('/api/does-not-exist').expect(404);
      expect(res.body).toEqual({ error: { code: 'NOT_FOUND', message: "This endpoint doesn't exist." } });
    });

    it('passes an AppError through with its own message', async () => {
      const res = await http.get('/api/probe/missing').expect(404);
      expect(res.body).toEqual({ error: { code: 'NOT_FOUND', message: 'Nothing here.' } });
    });

    it('hides the details of unexpected errors', async () => {
      const res = await http.get('/api/probe/boom').expect(500);
      expect(res.body.error.code).toBe('INTERNAL');
      expect(JSON.stringify(res.body)).not.toContain('secret driver detail');
    });
  });

  describe('Origin check on state-changing requests', () => {
    const body = { name: 'Cement', items: [] };

    it('rejects a request from another site', async () => {
      const res = await http.post('/api/probe/echo').set('Origin', 'https://evil.example').send(body).expect(403);
      expect(res.body.error.code).toBe('FORBIDDEN');
    });

    it('rejects a cookie-carrying request without an Origin header', async () => {
      await http.post('/api/probe/echo').set('Cookie', 'aricon_at=abc').send(body).expect(403);
    });

    it('allows a non-browser client that sends neither Origin nor cookies', async () => {
      await http.post('/api/probe/echo').send(body).expect(201);
    });
  });
});
