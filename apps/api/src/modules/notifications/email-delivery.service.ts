import { Injectable } from '@nestjs/common';
import { AppConfig } from '../../config/app-config.service.js';
import { SettingsService } from '../settings/settings.service.js';
import { renderEmail } from './email-templates.js';
import { MailService } from './mail.service.js';
import type { NotificationEvent, NotificationPayloads } from './notification-events.js';

/** Who an event goes to: one customer, or the staff list from settings. */
function recipients(payload: { to: string | string[] }): string[] {
  return (Array.isArray(payload.to) ? payload.to : [payload.to]).filter(Boolean);
}

/**
 * Turns one notification into a sent email: store details from settings (for the footer), the
 * rendered template, then SMTP. Runs inside the `send-email` job; throwing makes the job retry.
 */
@Injectable()
export class EmailDeliveryService {
  constructor(
    private readonly mail: MailService,
    private readonly settings: SettingsService,
    private readonly config: AppConfig,
  ) {}

  async deliver<E extends NotificationEvent>(event: E, payload: NotificationPayloads[E]): Promise<void> {
    const to = recipients(payload);
    if (to.length === 0) return;
    const settings = await this.settings.get();
    const email = renderEmail(event, payload, {
      storeName: settings.storeName,
      phone: settings.phone,
      email: settings.email,
      address: settings.address,
      appUrl: this.config.get('APP_URL'),
    });
    await this.mail.send({ ...email, to, ...('replyTo' in payload && { replyTo: payload.replyTo }) });
  }
}
