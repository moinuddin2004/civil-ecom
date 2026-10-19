import { Injectable, Logger } from '@nestjs/common';
import { NotificationsService } from '../notifications/notifications.service.js';
import { SettingsService } from '../settings/settings.service.js';
import type { RfpDto } from './rfp.dto.js';

/** Company-website inquiries (SPEC §7.2): emailed to `settings.rfpEmail`; nothing is stored. */
@Injectable()
export class RfpService {
  private readonly logger = new Logger(RfpService.name);

  constructor(
    private readonly settings: SettingsService,
    private readonly notifications: NotificationsService,
  ) {}

  async submit(input: RfpDto): Promise<void> {
    // A filled honeypot is a bot: answer like a success so it learns nothing, send nothing.
    if (input.website?.trim()) return;

    const { rfpEmail } = await this.settings.get();
    if (!rfpEmail) {
      // Never log the inquiry itself (personal data); just make the missing setting visible.
      this.logger.error('A company-website inquiry arrived but no RFP email is set in Settings; it was not sent.');
      return;
    }
    await this.notifications.notify('rfp.inquiry', {
      to: rfpEmail,
      replyTo: input.email,
      company: input.company,
      contactPerson: input.contactPerson,
      email: input.email,
      phone: input.phone ?? null,
      location: input.location ?? null,
      service: input.service,
      brief: input.brief,
    });
  }
}
