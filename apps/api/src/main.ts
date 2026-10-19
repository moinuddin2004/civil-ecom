import { NestFactory } from '@nestjs/core';
import type { NestExpressApplication } from '@nestjs/platform-express';
import type { Server } from 'node:http';
import { Logger } from 'nestjs-pino';
import { AppModule } from './app.module.js';
import { API_DOCS_PATH, API_PREFIX, configureApp } from './app.setup.js';
import { AppConfig } from './config/app-config.service.js';
import { EnvValidationError } from './config/env.schema.js';

async function bootstrap(): Promise<void> {
  const app = await NestFactory.create<NestExpressApplication>(AppModule, { bufferLogs: true, bodyParser: false });
  const logger = app.get(Logger);
  app.useLogger(logger);

  const config = app.get(AppConfig);
  configureApp(app, config);

  const host = config.get('HOST');
  const port = config.get('PORT');
  await app.listen(port, host);

  // Nginx keeps upstream connections alive for up to 60 s; stay open slightly longer so it never
  // reuses a socket this process is about to close.
  const server = app.getHttpServer() as Server;
  server.keepAliveTimeout = 65_000;
  server.headersTimeout = 66_000;

  logger.log(`API listening on http://${host}:${port}/${API_PREFIX} (profile: ${config.profile})`, 'Bootstrap');
  if (config.apiDocsEnabled) logger.log(`API docs at http://${host}:${port}/${API_DOCS_PATH}`, 'Bootstrap');

  // Nothing should ever be unhandled; if it is, state may be inconsistent — log and let PM2 restart.
  process.on('unhandledRejection', (reason) => {
    logger.error({ err: reason }, 'Unhandled promise rejection', 'Process');
    process.exit(1);
  });
}

bootstrap().catch((error: unknown) => {
  // Config errors are a readable list of problems; the logger may not exist yet, so use stderr.
  if (error instanceof EnvValidationError) console.error(error.message);
  else console.error('API failed to start:', error);
  process.exit(1);
});
