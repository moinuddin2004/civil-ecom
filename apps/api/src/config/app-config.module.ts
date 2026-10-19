import { Global, Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { AppConfig } from './app-config.service.js';
import { activeProfile, envFilesFor } from './env-files.js';
import { parseEnv } from './env.schema.js';

/**
 * Loads the active profile's env files, validates everything with `parseEnv` and exposes the
 * result as `AppConfig` to every module (global).
 */
@Global()
@Module({
  imports: [
    ConfigModule.forRoot({
      cache: true,
      envFilePath: envFilesFor(activeProfile()),
      validate: (raw) => parseEnv(raw),
    }),
  ],
  providers: [AppConfig],
  exports: [AppConfig],
})
export class AppConfigModule {}
