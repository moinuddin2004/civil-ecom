import { Injectable, Logger, type OnApplicationBootstrap } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import type { Model } from 'mongoose';
import { User } from './user.model.js';

/**
 * Safe migration for accounts created before email verification existed: a missing `emailVerified`
 * field means the account was already in use, so it is grandfathered as verified instead of being
 * locked out. The filter only touches documents where the field is absent, which makes the update
 * idempotent and leaves any explicit `emailVerified: false` untouched.
 */
@Injectable()
export class EmailVerificationMigration implements OnApplicationBootstrap {
  private readonly logger = new Logger(EmailVerificationMigration.name);

  constructor(@InjectModel(User.name) private readonly users: Model<User>) {}

  async onApplicationBootstrap(): Promise<void> {
    const result = await this.users.collection.updateMany(
      { emailVerified: { $exists: false } },
      [
        {
          $set: {
            emailVerified: true,
            emailVerifiedAt: { $ifNull: ['$createdAt', '$$NOW'] },
          },
        },
      ],
    );
    if (result.modifiedCount > 0) {
      this.logger.log(`Grandfathered ${result.modifiedCount} existing account(s) as email-verified.`);
    }
  }
}
