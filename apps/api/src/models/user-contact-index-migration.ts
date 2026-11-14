import { Injectable, type OnApplicationBootstrap } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import type { Model } from 'mongoose';
import { User } from './user.model.js';

const LEGACY_INDEXES = ['email_1', 'phone_1'];

@Injectable()
export class UserContactIndexMigration implements OnApplicationBootstrap {
  constructor(@InjectModel(User.name) private readonly users: Model<User>) {}

  async onApplicationBootstrap(): Promise<void> {
    const indexes = await this.users.collection.indexes();
    for (const name of LEGACY_INDEXES) {
      const index = indexes.find((candidate) => candidate.name === name);
      if (!index?.unique) continue;
      const partial = index.partialFilterExpression as
        Record<string, unknown> | undefined;
      if (partial?.deletedAt === null) continue;
      await this.users.collection.dropIndex(name);
    }

    await this.users.createIndexes();
  }
}
