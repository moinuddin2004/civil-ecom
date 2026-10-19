import { Global, Logger, Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import mongoose, { type Connection } from 'mongoose';
import { AppConfig } from '../config/app-config.service.js';
import { TransactionService } from './transaction.service.js';

// Reject unknown fields in filters and wrap user-supplied filter values in `$eq`, so request data
// can never inject query operators (CLAUDE.md §12). Global: applies to every query.
mongoose.set('strictQuery', true);
mongoose.set('sanitizeFilter', true);

const logger = new Logger('MongoDB');

function watchConnection(connection: Connection): Connection {
  connection.on('connected', () => logger.log('Connected'));
  connection.on('reconnected', () => logger.warn('Reconnected'));
  connection.on('disconnected', () => logger.warn('Disconnected'));
  connection.on('error', (err: unknown) => logger.error({ err }, 'Connection error'));
  return connection;
}

/**
 * MongoDB connection (a single-node replica set: order placement and restocking need
 * transactions, SPEC §3.3) and the shared transaction helper.
 *
 * `autoIndex` builds the indexes declared on each schema at startup (SPEC §5): idempotent and
 * cheap at this scale, and it guarantees unique constraints exist in every environment.
 */
@Global()
@Module({
  imports: [
    MongooseModule.forRootAsync({
      inject: [AppConfig],
      useFactory: (config: AppConfig) => ({
        uri: config.get('MONGODB_URI'),
        serverSelectionTimeoutMS: 10_000,
        maxPoolSize: 10,
        autoIndex: true,
        connectionFactory: watchConnection,
      }),
    }),
  ],
  providers: [TransactionService],
  exports: [TransactionService],
})
export class DatabaseModule {}
