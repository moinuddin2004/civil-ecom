import { isValidObjectId, type ClientSession, type Model, type QueryFilter, type SortOrder } from 'mongoose';
import { Paginated } from '../common/http/envelope.js';
import type { PaginationQueryDto } from '../common/http/pagination.dto.js';

/**
 * Base for every repository (the Spring Data idea): the only layer that talks to Mongoose. Services
 * hold business rules and call repositories; controllers only call services (CLAUDE.md §8).
 *
 * Reads return plain objects (`.lean()`, CLAUDE.md §12) typed as `TLean`; writes that need
 * validation hooks use the model directly in the concrete repository.
 */
export abstract class BaseRepository<TSchema, TLean = TSchema & { _id: unknown }> {
  protected constructor(protected readonly model: Model<TSchema>) {}

  /** `null` for a malformed id instead of a CastError, so callers simply answer 404. */
  async findById(id: string, session?: ClientSession): Promise<TLean | null> {
    if (!isValidObjectId(id)) return null;
    return this.model.findById(id, null, { session }).lean<TLean>().exec();
  }

  async findOne(filter: QueryFilter<TSchema>, session?: ClientSession): Promise<TLean | null> {
    return this.model.findOne(filter, null, { session }).lean<TLean>().exec();
  }

  /**
   * Loads, changes and saves the document, so every validator and hook runs (including the ones
   * that look at other fields or other documents, which update queries skip). Null if it's gone.
   */
  async updateById(id: string, changes: Partial<TSchema>, session?: ClientSession): Promise<TLean | null> {
    if (!isValidObjectId(id)) return null;
    const doc = await this.model.findById(id).session(session ?? null).exec();
    if (!doc) return null;
    doc.set(changes);
    await doc.save({ session });
    return doc.toObject<TLean>();
  }

  async exists(filter: QueryFilter<TSchema>): Promise<boolean> {
    return (await this.model.exists(filter).exec()) !== null;
  }

  async count(filter: QueryFilter<TSchema> = {}): Promise<number> {
    return this.model.countDocuments(filter).exec();
  }

  /** One page plus the total, run in parallel (SPEC §7.1: every list is paginated, max 100). */
  async paginate(
    filter: QueryFilter<TSchema>,
    pagination: Pick<PaginationQueryDto, 'page' | 'pageSize'>,
    sort: Record<string, SortOrder> = { createdAt: -1 },
  ): Promise<Paginated<TLean>> {
    const { page, pageSize } = pagination;
    const [items, total] = await Promise.all([
      this.model
        .find(filter)
        .sort(sort)
        .skip((page - 1) * pageSize)
        .limit(pageSize)
        .lean<TLean[]>()
        .exec(),
      this.model.countDocuments(filter).exec(),
    ]);
    return new Paginated(items, { page, pageSize, total });
  }
}
