import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import type { ClientSession, Model } from 'mongoose';
import { mergeSettings, Settings, SETTINGS_ID, type SettingsLean, type StoreSettings } from '../../models/settings.model.js';

/** The single `settings` document (SPEC §5.14). */
@Injectable()
export class SettingsRepository {
  constructor(@InjectModel(Settings.name) private readonly model: Model<Settings>) {}

  /** Stored settings over the defaults: every field is present even before an admin saves them. */
  async get(session?: ClientSession): Promise<StoreSettings> {
    return mergeSettings(await this.model.findById(SETTINGS_ID, null, { session }).lean<SettingsLean>().exec());
  }

  /**
   * Replaces the settings (creating the document on first save) through `save()`, so the schema's
   * validators and its "at least one payment method" hook run.
   */
  async replace(values: Omit<Settings, '_id' | 'createdAt' | 'updatedAt'>, session?: ClientSession): Promise<StoreSettings> {
    const doc = (await this.model.findById(SETTINGS_ID).session(session ?? null).exec()) ?? new this.model({ _id: SETTINGS_ID });
    doc.set(values);
    await doc.save({ session });
    return mergeSettings(doc.toObject<SettingsLean>());
  }
}
