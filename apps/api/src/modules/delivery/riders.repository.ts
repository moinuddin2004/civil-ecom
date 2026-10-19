import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import type { ClientSession, Model } from 'mongoose';
import { BaseRepository } from '../../database/base.repository.js';
import { Rider, type RiderLean } from '../../models/rider.model.js';

@Injectable()
export class RidersRepository extends BaseRepository<Rider, RiderLean> {
  constructor(@InjectModel(Rider.name) model: Model<Rider>) {
    super(model);
  }

  /** Active riders first, then by name. A shop has a handful. */
  findAll(): Promise<RiderLean[]> {
    return this.model.find().sort({ isActive: -1, name: 1 }).lean<RiderLean[]>().exec();
  }

  async create(input: Pick<Rider, 'name' | 'phone' | 'isActive'>, session?: ClientSession): Promise<RiderLean> {
    const [created] = await this.model.create([input], { session });
    if (!created) throw new Error('The rider was not created.');
    return created.toObject<RiderLean>();
  }

  update(id: string, changes: Partial<Pick<Rider, 'name' | 'phone' | 'isActive'>>, session?: ClientSession): Promise<RiderLean | null> {
    return this.model
      .findByIdAndUpdate(id, { $set: changes }, { returnDocument: 'after', runValidators: true, session })
      .lean<RiderLean>()
      .exec();
  }
}
