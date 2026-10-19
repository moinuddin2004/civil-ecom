import { IMPORT_JOB_STATUSES, type ImportJobStatus } from '@aricon/shared';
import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Schema as MongooseSchema, type HydratedDocument, type Types } from 'mongoose';
import { BASE_SCHEMA_OPTIONS, COUNT, maxItems, type Lean, TimestampedEntity } from './common.js';

/** At most this many row errors are stored; the summary still counts every failed row. */
export const MAX_IMPORT_ROW_ERRORS = 500;

@Schema({ _id: false, strict: true })
export class ImportRowError {
  /** Spreadsheet row number (1-based, as shown in Excel). */
  @Prop({ type: Number, required: true, min: 1 })
  row!: number;

  @Prop({ type: String, trim: true, maxlength: 60 })
  sku?: string;

  @Prop({ type: String, required: true, trim: true, maxlength: 500 })
  message!: string;
}

@Schema({ _id: false, strict: true })
export class ImportSummary {
  @Prop({ ...COUNT, required: true, default: 0 })
  created!: number;

  @Prop({ ...COUNT, required: true, default: 0 })
  updated!: number;

  @Prop({ ...COUNT, required: true, default: 0 })
  failed!: number;
}

/**
 * `importJobs` (SPEC §5.15, §12.3): progress of an Excel product import run by the
 * `import-products` job.
 *
 * SPEC calls the row error list `errors`, but that name is reserved on Mongoose documents (it holds
 * validation errors), so it is stored as `rowErrors`; the API DTO still calls it `errors`.
 */
@Schema({ ...BASE_SCHEMA_OPTIONS, collection: 'importJobs' })
export class ImportJob extends TimestampedEntity {
  /** Private storage key `imports/{jobId}.xlsx`. */
  @Prop({ type: String, required: true, trim: true, maxlength: 300 })
  fileKey!: string;

  @Prop({ type: String, enum: IMPORT_JOB_STATUSES, required: true, default: 'QUEUED' })
  status!: ImportJobStatus;

  @Prop({ ...COUNT, required: true, default: 0 })
  totalRows!: number;

  @Prop({ ...COUNT, required: true, default: 0 })
  processedRows!: number;

  @Prop({ type: SchemaFactory.createForClass(ImportSummary), default: () => ({}) })
  summary!: ImportSummary;

  @Prop({
    type: [SchemaFactory.createForClass(ImportRowError)],
    default: [],
    validate: maxItems(MAX_IMPORT_ROW_ERRORS, `Store at most ${MAX_IMPORT_ROW_ERRORS} row errors.`),
  })
  rowErrors!: ImportRowError[];

  @Prop({ type: MongooseSchema.Types.ObjectId, ref: 'User', required: true })
  createdByUserId!: Types.ObjectId;

  @Prop({ type: Date })
  startedAt?: Date;

  @Prop({ type: Date })
  finishedAt?: Date;
}

export type ImportJobDocument = HydratedDocument<ImportJob>;
export type ImportJobLean = Lean<ImportJob>;
export const ImportJobSchema = SchemaFactory.createForClass(ImportJob);

// Recent imports first on the import page.
ImportJobSchema.index({ createdAt: -1 });
