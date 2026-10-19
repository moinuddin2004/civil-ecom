import { Injectable, Logger, type OnModuleInit } from '@nestjs/common';
import { JobsService } from '../jobs/jobs.service.js';
import { EmailDeliveryService } from './email-delivery.service.js';
import type { NotificationEvent, NotificationPayloads } from './notification-events.js';

export type { EmailOrderLine, NotificationEvent, NotificationPayloads } from './notification-events.js';

/**
 * The single way the app sends a notification (SPEC §11): callers say *what happened*; this queues
 * a `send-email` job (Agenda, 2 at a time, 3 retries with exponential backoff), which renders the
 * template and sends it through SMTP — or logs it where no SMTP is configured (development).
 *
 * Never throws: a notification problem must not fail the request that triggered it.
 */
@Injectable()
export class NotificationsService implements OnModuleInit {
  private readonly logger = new Logger(NotificationsService.name);

  constructor(
    private readonly jobs: JobsService,
    private readonly delivery: EmailDeliveryService,
  ) {}

  onModuleInit(): void {
    this.jobs.register('send-email', ({ event, payload }) => this.delivery.deliver(event, payload), { concurrency: 2, retries: 3 });
  }

  async notify<E extends NotificationEvent>(event: E, payload: NotificationPayloads[E]): Promise<void> {
    try {
      await this.jobs.enqueue('send-email', { event, payload });
    } catch (error) {
      // Logged without the payload: it may hold links with tokens.
      this.logger.error({ err: error, event }, `Email "${event}" could not be queued`);
    }
  }
}
