import { Injectable } from '@nestjs/common';
import { InjectConnection } from '@nestjs/mongoose';
// Default import: `ConnectionStates` isn't one of the names Node can import from mongoose's CommonJS build.
import mongoose, { type Connection } from 'mongoose';

export interface HealthStatus {
  status: 'ok' | 'error';
  db: 'ok' | 'down';
}

const PING_TIMEOUT_MS = 2_000;

@Injectable()
export class HealthService {
  constructor(@InjectConnection() private readonly connection: Connection) {}

  async check(): Promise<HealthStatus> {
    const dbUp = await this.pingDatabase();
    return dbUp ? { status: 'ok', db: 'ok' } : { status: 'error', db: 'down' };
  }

  /** True when the database answers a ping within the timeout. Never throws. */
  private async pingDatabase(): Promise<boolean> {
    const { db, readyState } = this.connection;
    if (readyState !== mongoose.ConnectionStates.connected || !db) return false;

    let timer: NodeJS.Timeout | undefined;
    const timeout = new Promise<never>((_resolve, reject) => {
      timer = setTimeout(() => reject(new Error('Database ping timed out')), PING_TIMEOUT_MS);
    });
    try {
      await Promise.race([db.admin().ping(), timeout]);
      return true;
    } catch {
      return false;
    } finally {
      clearTimeout(timer);
    }
  }
}
