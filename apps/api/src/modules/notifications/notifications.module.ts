import { Global, Module } from '@nestjs/common';
import { SettingsModule } from '../settings/settings.module.js';
import { EmailDeliveryService } from './email-delivery.service.js';
import { MailService } from './mail.service.js';
import { NotificationsService } from './notifications.service.js';

@Global()
@Module({
  imports: [SettingsModule],
  providers: [NotificationsService, EmailDeliveryService, MailService],
  exports: [NotificationsService],
})
export class NotificationsModule {}
