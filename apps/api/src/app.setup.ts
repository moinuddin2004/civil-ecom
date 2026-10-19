import type { NestExpressApplication } from '@nestjs/platform-express';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import cookieParser from 'cookie-parser';
import type { Request } from 'express';
import helmet from 'helmet';
import { bodyParserErrorHandler } from './common/errors/body-parser-error.handler.js';
import type { AppConfig } from './config/app-config.service.js';

/** Every route lives under `/api` (SPEC §3.1: Nginx sends `/api/*` to this process). */
export const API_PREFIX = 'api';
export const API_DOCS_PATH = `${API_PREFIX}/docs`;
/** The one route other sites may call (company-website inquiries). */
export const RFP_PATH = `/${API_PREFIX}/public/rfp`;

/** JSON bodies are small; file uploads go through multipart with their own limits (SPEC §12.2). */
const BODY_LIMIT = '1mb';

/**
 * HTTP-level setup shared by `main.ts` and the e2e tests, so tests exercise exactly the production
 * pipeline. The app must be created with `{ bodyParser: false }` (the parsers are added here, with
 * our limits and error formatting).
 */
export function configureApp(app: NestExpressApplication, config: AppConfig): void {
  // Nginx (behind Cloudflare) forwards the real client IP; rate limits key on it.
  app.set('trust proxy', 1);
  app.disable('x-powered-by');

  app.use(helmet());
  app.use(cookieParser());
  app.useBodyParser('json', { limit: BODY_LIMIT });
  app.useBodyParser('urlencoded', { extended: false, limit: BODY_LIMIT });
  // Must follow the parsers: formats invalid JSON / oversized bodies like any other API error.
  app.use(bodyParserErrorHandler);

  // Cross-origin calls are refused everywhere except the company-website inquiry form, which may
  // post from the origins in RFP_CORS_ORIGINS (SPEC §7.2). No cookies are involved there.
  app.enableCors((req: Request, callback) => {
    callback(
      null,
      req.path === RFP_PATH
        ? { origin: config.get('RFP_CORS_ORIGINS'), methods: ['POST'], allowedHeaders: ['Content-Type'], maxAge: 600 }
        : { origin: false },
    );
  });

  app.setGlobalPrefix(API_PREFIX);
  // Graceful shutdown on SIGTERM/SIGINT (PM2 reload): stop accepting requests, close Mongo.
  app.enableShutdownHooks();

  if (config.apiDocsEnabled) setupApiDocs(app);
}

function setupApiDocs(app: NestExpressApplication): void {
  const document = SwaggerModule.createDocument(
    app,
    new DocumentBuilder()
      .setTitle('Aricon API')
      .setDescription(
        'Storefront, customer account and admin panel API. Successful responses are wrapped in ' +
          '`{ data }` (lists: `{ data, meta }`); errors are `{ error: { code, message, details? } }`.',
      )
      .setVersion('1.0')
      .addCookieAuth('aricon_at', { type: 'apiKey', in: 'cookie' }, 'customer')
      .addCookieAuth('aricon_admin_at', { type: 'apiKey', in: 'cookie' }, 'admin')
      .addBearerAuth({ type: 'http', scheme: 'bearer', bearerFormat: 'JWT' }, 'bearer')
      .build(),
  );
  SwaggerModule.setup(API_DOCS_PATH, app, document, { jsonDocumentUrl: `${API_DOCS_PATH}/json` });
}
