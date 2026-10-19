import { MongoBackend } from '@agendajs/mongo-backend';
import { Injectable, Logger, type OnApplicationBootstrap, type OnApplicationShutdown, type OnModuleInit } from '@nestjs/common';
import { Agenda, exponential, type Job, type JobWithId } from 'agenda';
import { AppConfig } from '../../config/app-config.service.js';
import type { NotificationEvent, NotificationPayloads } from '../notifications/notification-events.js';

/** The background jobs (SPEC §13) and what each one carries. */
export interface JobPayloads {
  'send-email': { event: NotificationEvent; payload: NotificationPayloads[NotificationEvent] };
  'import-products': { jobId: string };
}
export type JobName = keyof JobPayloads;

export interface JobOptions {
  concurrency: number;
  /** Retries after a failure, with exponential backoff. 0 = no retry. */
  retries?: number;
  /** How long a running job keeps its lock before another worker may take it over. */
  lockLifetimeMs?: number;
}

/** Long enough for a full import on one vCPU; email jobs finish in seconds. */
const DEFAULT_LOCK_MS = 10 * 60_000;
const SHUTDOWN_DRAIN_MS = 15_000;

/**
 * Agenda inside the API process (SPEC §13, CLAUDE.md §32, §39), stored in the app's own MongoDB
 * (`agendaJobs`, SPEC §5.17). Agenda's backend brings its own MongoDB driver, so it gets its own
 * small connection to the same database rather than Mongoose's (two driver copies must not mix). Modules register their handlers in `onModuleInit`; Agenda starts once
 * the app has booted (polling every 5 seconds) and, on SIGTERM, lets the running job finish before
 * the database closes.
 *
 * Failures are logged by job name only — job data may hold emails and links.
 */
@Injectable()
export class JobsService implements OnModuleInit, OnApplicationBootstrap, OnApplicationShutdown {
  private readonly logger = new Logger(JobsService.name);
  private agenda?: Agenda;

  constructor(private readonly config: AppConfig) {}

  onModuleInit(): void {
    this.agenda = new Agenda({
      backend: new MongoBackend({ address: this.config.get('MONGODB_URI'), options: { maxPoolSize: 5 }, collection: 'agendaJobs' }),
      name: `api-${process.pid}`,
      // Tests wait for jobs; poll faster there.
      processEvery: this.config.isTest ? 100 : '5 seconds',
      maxConcurrency: 4,
      defaultLockLifetime: DEFAULT_LOCK_MS,
    });
    this.agenda.on('fail', (error: Error, job: JobWithId) => {
      this.logger.error({ job: job.attrs.name, err: error }, `Job "${job.attrs.name}" failed`);
    });
  }

  /** Called by the module that owns the job, in its `onModuleInit`. */
  register<N extends JobName>(name: N, handler: (data: JobPayloads[N]) => Promise<void>, options: JobOptions): void {
    this.instance().define<JobPayloads[N]>(
      name,
      async (job: Job<JobPayloads[N]>) => {
        await handler(job.attrs.data);
      },
      {
        concurrency: options.concurrency,
        lockLifetime: options.lockLifetimeMs ?? DEFAULT_LOCK_MS,
        removeOnComplete: true,
        ...(options.retries ? { backoff: exponential({ delay: 30_000, factor: 2, maxRetries: options.retries }) } : {}),
      },
    );
  }

  /** Queues a job to run as soon as a worker is free. */
  async enqueue<N extends JobName>(name: N, data: JobPayloads[N]): Promise<void> {
    await this.instance().now<JobPayloads[N]>(name, data);
  }

  async onApplicationBootstrap(): Promise<void> {
    await this.instance().start();
  }

  /** Lets running jobs finish (drain also closes Agenda's connection); stragglers are unlocked. */
  async onApplicationShutdown(): Promise<void> {
    if (!this.agenda) return;
    const result = await this.agenda.drain(SHUTDOWN_DRAIN_MS);
    if (result.timedOut) {
      this.logger.warn({ running: result.running }, 'Jobs still running at shutdown; another start picks them up');
      await this.agenda.stop();
    }
  }

  private instance(): Agenda {
    if (!this.agenda) throw new Error('Jobs are not initialised yet');
    return this.agenda;
  }
}
