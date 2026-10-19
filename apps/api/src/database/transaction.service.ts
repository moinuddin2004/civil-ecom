import { Injectable } from '@nestjs/common';
import { InjectConnection } from '@nestjs/mongoose';
import type { ClientSession, Connection } from 'mongoose';

/**
 * All reads in a transaction see one consistent snapshot, and the commit waits until it is durable
 * on the replica set (a single node in production, so this costs nothing extra).
 */
const TRANSACTION_OPTIONS = {
  readConcern: { level: 'snapshot' },
  writeConcern: { w: 'majority' },
} as const;

/**
 * The one way to run a multi-document write (CLAUDE.md §13): orders, stock, cancels, restocks,
 * refresh-token rotation.
 *
 * - The driver retries the whole callback on transient errors (e.g. a write conflict with a
 *   concurrent order) and retries the commit on unknown results, so `fn` must be safe to run more
 *   than once: no emails, uploads or other side effects inside it.
 * - Throwing inside `fn` aborts the transaction and the error (usually an `AppError`) propagates
 *   unchanged, so nothing is written.
 * - Pass `{ session }` to every query and save inside `fn`, and await operations one after another;
 *   the driver does not support parallel operations in one transaction.
 */
@Injectable()
export class TransactionService {
  constructor(@InjectConnection() private readonly connection: Connection) {}

  async run<T>(fn: (session: ClientSession) => Promise<T>): Promise<T> {
    const session = await this.connection.startSession();
    try {
      return await session.withTransaction(() => fn(session), TRANSACTION_OPTIONS);
    } finally {
      await session.endSession();
    }
  }
}
