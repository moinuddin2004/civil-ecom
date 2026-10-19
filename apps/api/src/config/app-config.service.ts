import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { Env, Profile } from './env.schema.js';

/**
 * Typed access to the validated configuration (the equivalent of Spring's
 * `@ConfigurationProperties`). Inject this, never `process.env`, anywhere in the app.
 */
@Injectable()
export class AppConfig {
  constructor(private readonly config: ConfigService<Env, true>) {}

  get<K extends keyof Env>(key: K): Env[K] {
    return this.config.get(key, { infer: true });
  }

  get profile(): Profile {
    return this.get('NODE_ENV');
  }

  get isProduction(): boolean {
    return this.profile === 'production';
  }

  get isDevelopment(): boolean {
    return this.profile === 'development';
  }

  get isTest(): boolean {
    return this.profile === 'test';
  }

  /** Swagger UI is never served in production. */
  get apiDocsEnabled(): boolean {
    return !this.isProduction && this.get('API_DOCS_ENABLED');
  }

  /** Origins allowed to make state-changing requests with cookies (the Origin check, SPEC §7.1). */
  get trustedOrigins(): string[] {
    const origins = [new URL(this.get('APP_URL')).origin];
    // `next dev` may be opened on either name locally.
    if (!this.isProduction) origins.push('http://localhost:3000', 'http://127.0.0.1:3000');
    return [...new Set(origins)];
  }
}
