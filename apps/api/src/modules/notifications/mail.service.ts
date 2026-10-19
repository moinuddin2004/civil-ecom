import { Injectable, Logger } from '@nestjs/common';
import nodemailer, { type Transporter } from 'nodemailer';
import { AppConfig } from '../../config/app-config.service.js';
import type { RenderedEmail } from './email-templates.js';

export interface OutgoingEmail extends RenderedEmail {
  to: string | readonly string[];
  replyTo?: string;
}

/**
 * SMTP through Nodemailer (CLAUDE.md §33, settings from env only). Without `SMTP_HOST` —
 * development and tests — the email is written to the log instead (SPEC §3.3: no real mail from
 * dev); production can't start without SMTP (env schema).
 */
@Injectable()
export class MailService {
  private readonly logger = new Logger(MailService.name);
  private readonly transport: Transporter | null;
  private readonly from: string;

  constructor(config: AppConfig) {
    this.from = config.get('MAIL_FROM');
    const host = config.get('SMTP_HOST');
    const port = config.get('SMTP_PORT') ?? 587;
    const user = config.get('SMTP_USER');
    this.transport = host
      ? nodemailer.createTransport({
          host,
          port,
          secure: port === 465,
          ...(user && { auth: { user, pass: config.get('SMTP_PASS') ?? '' } }),
        })
      : null;
  }

  /** Throws when the SMTP server refuses, so the job is retried. */
  async send(email: OutgoingEmail): Promise<void> {
    const to = typeof email.to === 'string' ? [email.to] : [...email.to];
    if (!this.transport) {
      this.logger.log({ to, subject: email.subject, text: email.text }, `Email "${email.subject}" (no SMTP configured: logged, not sent)`);
      return;
    }
    await this.transport.sendMail({
      from: this.from,
      to,
      ...(email.replyTo && { replyTo: email.replyTo }),
      subject: email.subject,
      html: email.html,
      text: email.text,
    });
  }
}
