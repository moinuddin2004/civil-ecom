import { formatOrderNumber, orderNumberContext } from '@aricon/shared';
import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import type { ClientSession, Model } from 'mongoose';
import { Counter } from '../../models/counter.model.js';

/** Order numbers `ARC-{YYYY}-{000123}` from a yearly counter (SPEC §5.11, §6.9). */
@Injectable()
export class OrderNumbersRepository {
  constructor(@InjectModel(Counter.name) private readonly counters: Model<Counter>) {}

  /**
   * The next number for the Karachi year of `now`. Runs inside the order transaction, so an order
   * that is rolled back doesn't use up a number.
   */
  async next(now: Date, session: ClientSession): Promise<string> {
    const { year, counterId } = orderNumberContext(now);
    const counter = await this.counters
      .findOneAndUpdate({ _id: counterId }, { $inc: { seq: 1 } }, { upsert: true, returnDocument: 'after', session })
      .lean<{ seq: number }>()
      .exec();
    if (!counter) throw new Error(`Counter ${counterId} was not created.`);
    return formatOrderNumber(year, counter.seq);
  }
}
