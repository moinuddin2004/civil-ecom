import { Injectable, Logger, type OnApplicationShutdown } from '@nestjs/common';
import { AppConfig } from '../../config/app-config.service.js';

/** Edits are pushed quickly; stock changes (orders, adjustments) are batched (SPEC §14: 60 s). */
export const REVALIDATE_SOON_MS = 2_000;
export const REVALIDATE_STOCK_MS = 60_000;

const REQUEST_TIMEOUT_MS = 5_000;

/**
 * Tells the web app which cached pages are stale (SPEC §3.1, §14): `POST {WEB_INTERNAL_URL}/_internal/revalidate`
 * with `x-revalidate-secret`. Tags are collected and sent in one call (debounced), so a bulk edit
 * makes one request, not hundreds.
 *
 * Best effort by design: a failed call is logged and dropped — pages still refresh on their own
 * ISR timer (300 s) — and it never fails the admin write that triggered it.
 */
@Injectable()
export class RevalidationService implements OnApplicationShutdown {
  private readonly logger = new Logger(RevalidationService.name);
  private readonly pending = new Set<string>();
  private timer: NodeJS.Timeout | null = null;
  private dueAt = Number.POSITIVE_INFINITY;

  constructor(private readonly config: AppConfig) {}

  /** Queues tags (from `CACHE_TAGS`); they are sent within `delayMs`. */
  revalidate(tags: readonly string[], delayMs = REVALIDATE_SOON_MS): void {
    for (const tag of tags) this.pending.add(tag);
    if (this.pending.size === 0) return;

    const due = Date.now() + delayMs;
    if (this.timer && due >= this.dueAt) return; // an earlier send already covers these tags
    if (this.timer) clearTimeout(this.timer);
    this.dueAt = due;
    this.timer = setTimeout(() => void this.flush(), delayMs);
    this.timer.unref(); // never keeps the process alive on shutdown
  }

  onApplicationShutdown(): void {
    if (this.timer) clearTimeout(this.timer);
    this.timer = null;
  }

  private async flush(): Promise<void> {
    const tags = [...this.pending];
    this.pending.clear();
    this.timer = null;
    this.dueAt = Number.POSITIVE_INFINITY;
    if (tags.length === 0) return;

    try {
      const res = await fetch(new URL('/_internal/revalidate', this.config.get('WEB_INTERNAL_URL')), {
        method: 'POST',
        headers: { 'content-type': 'application/json', 'x-revalidate-secret': this.config.get('REVALIDATE_SECRET') },
        body: JSON.stringify({ tags }),
        signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
      });
      if (!res.ok) this.logger.warn({ status: res.status, tags }, 'The web app refused the revalidation call');
    } catch (error) {
      this.logger.warn({ err: error, tags }, 'Could not reach the web app to revalidate pages');
    }
  }
}
