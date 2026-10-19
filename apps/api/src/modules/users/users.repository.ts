import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import mongoose, { Types, type ClientSession, type Model } from 'mongoose';
import { BaseRepository } from '../../database/base.repository.js';
import { User, type AddressData, type UserLean } from '../../models/user.model.js';

const { trusted } = mongoose;

/** A user read for authentication, including the password hash (never leaves the auth services). */
export type UserWithPassword = UserLean & { passwordHash: string };

/** The fields the auth guard needs on every request (SPEC §3.2: loaded from the DB, not the token). */
export type AuthView = Pick<UserLean, '_id' | 'name' | 'email' | 'role' | 'status' | 'permissions' | 'mustChangePassword'>;

export interface AddressBook {
  addresses: AddressData[];
  version: number;
}

export const MAX_FAILED_LOGINS = 5;
export const LOCKOUT_MS = 15 * 60_000;

export interface NewUser {
  name: string;
  email: string;
  phone?: string;
  passwordHash: string;
  role: User['role'];
  permissions?: User['permissions'];
  companyName?: string;
  mustChangePassword?: boolean;
}

@Injectable()
export class UsersRepository extends BaseRepository<User, UserLean> {
  constructor(@InjectModel(User.name) model: Model<User>) {
    super(model);
  }

  async create(input: NewUser, session?: ClientSession): Promise<UserLean> {
    const [created] = await this.model.create(
      [
        {
          ...input,
          permissions: input.permissions ?? [],
          status: 'active',
          addresses: [],
          mustChangePassword: input.mustChangePassword ?? false,
          failedLogins: 0,
        },
      ],
      { session },
    );
    if (!created) throw new Error('User was not created.');
    // `toObject` runs the schema transform, which drops the password hash.
    return created.toObject<UserLean>();
  }

  emailExists(email: string): Promise<boolean> {
    return this.exists({ email });
  }

  phoneExists(phone: string): Promise<boolean> {
    return this.exists({ phone });
  }

  async findForLogin(filter: { email: string } | { phone: string }): Promise<UserWithPassword | null> {
    return this.model.findOne(filter).select('+passwordHash').lean<UserWithPassword>().exec();
  }

  async findWithPasswordById(id: string | Types.ObjectId): Promise<UserWithPassword | null> {
    return this.model.findById(id).select('+passwordHash').lean<UserWithPassword>().exec();
  }

  async findAuthView(id: string): Promise<AuthView | null> {
    if (!mongoose.isValidObjectId(id)) return null;
    return this.model
      .findById(id)
      .select({ name: 1, email: 1, role: 1, status: 1, permissions: 1, mustChangePassword: 1 })
      .lean<AuthView>()
      .exec();
  }

  /**
   * Counts a failed login atomically (parallel attempts can't slip past the limit). The attempt
   * that reaches the limit locks the account for 15 minutes and resets the counter (SPEC §6.11).
   * Returns the lock expiry when this attempt locked the account.
   */
  async recordFailedLogin(id: Types.ObjectId, now: Date): Promise<Date | null> {
    const updated = await this.model
      .findByIdAndUpdate(id, { $inc: { failedLogins: 1 } }, { returnDocument: 'after', projection: { failedLogins: 1 } })
      .lean()
      .exec();
    if (!updated || updated.failedLogins < MAX_FAILED_LOGINS) return null;

    const lockedUntil = new Date(now.getTime() + LOCKOUT_MS);
    await this.model.updateOne({ _id: id }, { $set: { lockedUntil, failedLogins: 0 } }).exec();
    return lockedUntil;
  }

  async recordSuccessfulLogin(id: Types.ObjectId, now: Date): Promise<void> {
    await this.model
      .updateOne({ _id: id }, { $set: { failedLogins: 0, lastLoginAt: now }, $unset: { lockedUntil: 1 } })
      .exec();
  }

  /** Phone used by any other account (customers' phones are unique, SPEC §5.1). */
  phoneTakenByOther(phone: string, userId: string): Promise<boolean> {
    return this.exists({ phone, _id: trusted({ $ne: new Types.ObjectId(userId) }) });
  }

  /** `companyName: null` clears it; `undefined` leaves it as is. Returns the updated user. */
  updateProfile(
    userId: string,
    profile: { name: string; phone: string; companyName?: string | null },
  ): Promise<UserLean | null> {
    const set: Partial<Pick<User, 'name' | 'phone' | 'companyName'>> = { name: profile.name, phone: profile.phone };
    if (profile.companyName) set.companyName = profile.companyName;
    const update = profile.companyName === null ? { $set: set, $unset: { companyName: 1 } } : { $set: set };
    return this.model
      .findByIdAndUpdate(userId, update, { returnDocument: 'after', runValidators: true })
      .lean<UserLean>()
      .exec();
  }

  /** Saved addresses plus the document version, for an optimistic `saveAddresses`. */
  async addressBook(userId: string): Promise<AddressBook | null> {
    const user = await this.model
      .findById(userId, { addresses: 1, __v: 1 })
      .lean<Pick<UserLean, 'addresses'> & { __v?: number }>()
      .exec();
    return user ? { addresses: user.addresses, version: user.__v ?? 0 } : null;
  }

  /**
   * Replaces the addresses only if nobody saved them since `version` was read (two tabs editing at
   * once). Returns false on such a conflict. Schema validators (max 10, one default) still run.
   */
  async saveAddresses(userId: string, version: number, addresses: readonly AddressData[]): Promise<boolean> {
    const result = await this.model
      .updateOne(
        { _id: new Types.ObjectId(userId), __v: version },
        { $set: { addresses: [...addresses] }, $inc: { __v: 1 } },
        { runValidators: true },
      )
      .exec();
    return result.matchedCount === 1;
  }

  /** Staff and admins, admins first (SPEC §10.8 "Staff" tab). A shop has a handful. */
  findStaff(): Promise<UserLean[]> {
    return this.model
      .find({ role: trusted({ $in: ['ADMIN', 'STAFF'] }) })
      .sort({ role: 1, name: 1 })
      .lean<UserLean[]>()
      .exec();
  }

  /** Active admins other than `exceptId` (SPEC §4.5 rule 4: there must always be one). */
  countOtherActiveAdmins(exceptId: string, session?: ClientSession): Promise<number> {
    return this.model
      .countDocuments({ role: 'ADMIN', status: 'active', _id: trusted({ $ne: new Types.ObjectId(exceptId) }) })
      .session(session ?? null)
      .exec();
  }

  /** `$set` / `$unset` on a staff account; validators run. Returns the updated user. */
  updateFields(
    id: string,
    set: Partial<Pick<User, 'name' | 'phone' | 'role' | 'permissions' | 'status'>>,
    unset: readonly 'phone'[] = [],
    session?: ClientSession,
  ): Promise<UserLean | null> {
    const update = unset.length > 0 ? { $set: set, $unset: Object.fromEntries(unset.map((key) => [key, 1])) } : { $set: set };
    return this.model.findByIdAndUpdate(id, update, { returnDocument: 'after', runValidators: true, session }).lean<UserLean>().exec();
  }

  /** Admin reset (SPEC §6.11): a new temporary password the staff member must change at next login. */
  async setTemporaryPassword(id: string, passwordHash: string, session?: ClientSession): Promise<void> {
    await this.model
      .updateOne(
        { _id: new Types.ObjectId(id) },
        { $set: { passwordHash, mustChangePassword: true, failedLogins: 0 }, $unset: { lockedUntil: 1 } },
        { session },
      )
      .exec();
  }

  /** New password; also clears a lockout and the forced-change flag. */
  async setPassword(id: Types.ObjectId | string, passwordHash: string, session?: ClientSession): Promise<void> {
    await this.model
      .updateOne(
        { _id: id },
        { $set: { passwordHash, mustChangePassword: false, failedLogins: 0 }, $unset: { lockedUntil: 1 } },
        { session },
      )
      .exec();
  }
}
