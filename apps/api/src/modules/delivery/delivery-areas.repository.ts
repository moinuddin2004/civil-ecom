import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import mongoose, { Types, type ClientSession, type Model } from 'mongoose';
import { BaseRepository } from '../../database/base.repository.js';
import { DeliveryArea, type DeliveryAreaLean } from '../../models/delivery-area.model.js';

const { trusted } = mongoose;

export type AreaFields = Pick<DeliveryArea, 'name' | 'city' | 'isServiceable' | 'deliveryFee' | 'freeDeliveryAbove' | 'sortOrder'>;

@Injectable()
export class DeliveryAreasRepository extends BaseRepository<DeliveryArea, DeliveryAreaLean> {
  constructor(@InjectModel(DeliveryArea.name) model: Model<DeliveryArea>) {
    super(model);
  }

  async findByIds(ids: readonly (string | Types.ObjectId)[]): Promise<DeliveryAreaLean[]> {
    const unique = [...new Set(ids.map(String))].filter((id) => Types.ObjectId.isValid(id));
    if (unique.length === 0) return [];
    return this.model
      .find({ _id: trusted({ $in: unique.map((id) => new Types.ObjectId(id)) }) })
      .lean<DeliveryAreaLean[]>()
      .exec();
  }

  /** Every area (serviceable or not), in display order. A city has a few dozen at most. */
  findAll(): Promise<DeliveryAreaLean[]> {
    return this.model.find().sort({ sortOrder: 1, name: 1 }).lean<DeliveryAreaLean[]>().exec();
  }

  async create(input: AreaFields, session?: ClientSession): Promise<DeliveryAreaLean> {
    const [created] = await this.model.create([input], { session });
    if (!created) throw new Error('The delivery area was not created.');
    return created.toObject<DeliveryAreaLean>();
  }

  update(id: string, changes: Partial<AreaFields>, session?: ClientSession): Promise<DeliveryAreaLean | null> {
    return this.model
      .findByIdAndUpdate(id, { $set: changes }, { returnDocument: 'after', runValidators: true, session })
      .lean<DeliveryAreaLean>()
      .exec();
  }
}
