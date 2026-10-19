import { Module } from '@nestjs/common';
import { APP_FILTER, APP_GUARD, APP_INTERCEPTOR, APP_PIPE } from '@nestjs/core';
import { seconds, ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';
import { LoggerModule } from 'nestjs-pino';
import { AppConfig } from '../config/app-config.service.js';
import { AllExceptionsFilter } from './errors/all-exceptions.filter.js';
import { ResponseEnvelopeInterceptor } from './http/response-envelope.interceptor.js';
import { loggerParams } from './logging/logger.config.js';
import { OriginGuard } from './security/origin.guard.js';
import { createValidationPipe } from './validation/validation.js';

/**
 * Cross-cutting behaviour every endpoint gets (logging, validation, envelope, errors, rate limits,
 * Origin check), registered once as global providers so feature modules stay plain.
 *
 * Guards run in registration order: rate limit first (cheapest rejection), then the Origin check;
 * the auth guards are added by the auth module.
 */
@Module({
  imports: [
    LoggerModule.forRootAsync({ inject: [AppConfig], useFactory: loggerParams }),
    // A generous global ceiling per IP; sensitive endpoints set stricter limits with @Throttle()
    // (SPEC §7.1). One API process (SPEC §18.3), so in-memory storage is enough.
    ThrottlerModule.forRootAsync({
      inject: [AppConfig],
      useFactory: (config: AppConfig) => ({
        throttlers: [{ name: 'default', ttl: seconds(60), limit: 300 }],
        skipIf: () => !config.get('RATE_LIMIT_ENABLED'),
      }),
    }),
  ],
  providers: [
    { provide: APP_FILTER, useClass: AllExceptionsFilter },
    { provide: APP_PIPE, useFactory: createValidationPipe },
    { provide: APP_INTERCEPTOR, useClass: ResponseEnvelopeInterceptor },
    { provide: APP_GUARD, useClass: ThrottlerGuard },
    { provide: APP_GUARD, useClass: OriginGuard },
  ],
})
export class CommonModule {}
