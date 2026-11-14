import { Injectable, Logger, type OnApplicationBootstrap } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { trusted, type Model } from 'mongoose';
import { Order } from '../../models/order.model.js';
import { newTrackingCode } from './order-tracking-code.js';

const BATCH = 200;
const ATTEMPTS_PER_ORDER = 8;

/**
 * Gives a tracking code to every order that was placed before codes existed (SPEC §6.6b), once at
 * start-up. Safe to run again: it only touches orders without a code, and the partial unique index
 * makes a clash a retry with a new code.
 */
@Injectable()
export class TrackingCodeBackfillService implements OnApplicationBootstrap {
  private readonly logger = new Logger(TrackingCodeBackfillService.name);

  constructor(@InjectModel(Order.name) private readonly orders: Model<Order>) {}

  async onApplicationBootstrap(): Promise<void> {
    try {
      let done = 0;
      for (;;) {
        // `trusted()`: the global sanitizeFilter would otherwise cast the `$exists` operator to a string.
        const batch = await this.orders.find({ trackingCode: trusted({ $exists: false }) }, { _id: 1 }).limit(BATCH).lean().exec();
        if (batch.length === 0) break;
        for (const { _id } of batch) {
          for (let attempt = 0; attempt < ATTEMPTS_PER_ORDER; attempt += 1) {
            try {
              await this.orders.updateOne({ _id, trackingCode: trusted({ $exists: false }) }, { $set: { trackingCode: newTrackingCode() } }, { timestamps: false }).exec();
              done += 1;
              break;
            } catch (error) {
              if (attempt === ATTEMPTS_PER_ORDER - 1) throw error;
            }
          }
        }
      }
      if (done > 0) this.logger.log(`Gave ${done} existing orders a tracking code`);
    } catch (error) {
      // Never stops the API from starting; the next start tries again.
      this.logger.warn({ err: error }, 'Could not give existing orders a tracking code');
    }
  }
}
