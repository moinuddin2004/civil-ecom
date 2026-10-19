import { randomUUID } from 'node:crypto';
import type { IncomingMessage, ServerResponse } from 'node:http';
import type { Params } from 'nestjs-pino';
import type { AppConfig } from '../../config/app-config.service.js';

const REQUEST_ID = /^[A-Za-z0-9-]{8,64}$/;

/**
 * Never logged, wherever they appear (CLAUDE.md §29, §35). The request serializer below already
 * whitelists fields; this is the second line of defence for anything logged by hand.
 */
const REDACT_PATHS = [
  'req.headers.cookie',
  'req.headers.authorization',
  'req.headers["x-revalidate-secret"]',
  'res.headers["set-cookie"]',
  '*.password',
  '*.passwordHash',
  '*.currentPassword',
  '*.newPassword',
  '*.token',
  '*.tokenHash',
  '*.accessToken',
  '*.refreshToken',
];

type Req = IncomingMessage & { id?: string | number; originalUrl?: string; ip?: string };

/**
 * pino + pino-http (the fixed logging stack): JSON lines in production (collected by PM2), pretty
 * output in development, one line per request with a request id that is reused from a well-formed
 * `x-request-id` and echoed back, so a log line can be matched to a customer's report.
 */
export function loggerParams(config: AppConfig): Params {
  return {
    pinoHttp: {
      level: config.get('LOG_LEVEL'),
      redact: { paths: REDACT_PATHS, censor: '[redacted]' },
      genReqId(req: IncomingMessage, res: ServerResponse) {
        const incoming = req.headers['x-request-id'];
        const id = typeof incoming === 'string' && REQUEST_ID.test(incoming) ? incoming : randomUUID();
        res.setHeader('x-request-id', id);
        return id;
      },
      // Whitelist: never headers, cookies or bodies.
      serializers: {
        req: (req: Req) => ({ id: req.id, method: req.method, url: req.originalUrl ?? req.url, ip: req.ip }),
        res: (res: { statusCode: number }) => ({ statusCode: res.statusCode }),
      },
      customLogLevel(_req, res, err) {
        if (err || res.statusCode >= 500) return 'error';
        if (res.statusCode >= 400) return 'warn';
        return 'info';
      },
      // Uptime checks hit this every minute; they only add noise.
      autoLogging: { ignore: (req) => req.url === '/api/health' },
      transport: config.isDevelopment
        ? {
            target: 'pino-pretty',
            options: { colorize: true, translateTime: 'SYS:HH:MM:ss.l', ignore: 'pid,hostname', singleLine: true },
          }
        : undefined,
    },
  };
}
