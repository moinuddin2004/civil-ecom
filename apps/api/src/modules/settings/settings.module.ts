import { Module } from '@nestjs/common';
import { AdminSettingsController } from './admin-settings.controller.js';
import { AdminSettingsService } from './admin-settings.service.js';
import { SettingsController } from './settings.controller.js';
import { SettingsRepository } from './settings.repository.js';
import { SettingsService } from './settings.service.js';

/** Store settings: public views (SPEC §7.2) and ADMIN editing (SPEC §7.3). */
@Module({
  controllers: [SettingsController, AdminSettingsController],
  providers: [SettingsRepository, SettingsService, AdminSettingsService],
  exports: [SettingsService],
})
export class SettingsModule {}
