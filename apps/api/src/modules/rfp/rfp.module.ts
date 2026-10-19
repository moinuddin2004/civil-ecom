import { Module } from '@nestjs/common';
import { SettingsModule } from '../settings/settings.module.js';
import { RfpController } from './rfp.controller.js';
import { RfpService } from './rfp.service.js';

@Module({
  imports: [SettingsModule],
  controllers: [RfpController],
  providers: [RfpService],
})
export class RfpModule {}
