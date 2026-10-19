import type { ImportJobDTO } from '@aricon/shared';
import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Types, type Model } from 'mongoose';
import { ImportJob, MAX_IMPORT_ROW_ERRORS, type ImportJobLean, type ImportRowError, type ImportSummary } from '../../models/import-job.model.js';

export function toImportJobDto(job: ImportJobLean): ImportJobDTO {
  return {
    id: String(job._id),
    status: job.status,
    totalRows: job.totalRows,
    processedRows: job.processedRows,
    summary: { created: job.summary.created, updated: job.summary.updated, failed: job.summary.failed },
    errors: job.rowErrors.map((error) => ({ row: error.row, sku: error.sku ?? null, message: error.message })),
    createdAt: job.createdAt.toISOString(),
    startedAt: job.startedAt?.toISOString() ?? null,
    finishedAt: job.finishedAt?.toISOString() ?? null,
  };
}

/** `importJobs` (SPEC §5.15): one document per uploaded file, updated as the job runs. */
@Injectable()
export class ImportJobsRepository {
  constructor(@InjectModel(ImportJob.name) private readonly model: Model<ImportJob>) {}

  async create(id: Types.ObjectId, fileKey: string, createdByUserId: string): Promise<ImportJobLean> {
    const job = await this.model.create({ _id: id, fileKey, status: 'QUEUED', createdByUserId: new Types.ObjectId(createdByUserId) });
    return job.toObject<ImportJobLean>();
  }

  findById(id: string): Promise<ImportJobLean | null> {
    if (!Types.ObjectId.isValid(id)) return Promise.resolve(null);
    return this.model.findById(id).lean<ImportJobLean>().exec();
  }

  async start(id: string, totalRows: number): Promise<void> {
    await this.model.updateOne({ _id: id }, { $set: { status: 'RUNNING', totalRows, processedRows: 0, startedAt: new Date() } }).exec();
  }

  async progress(id: string, processedRows: number): Promise<void> {
    await this.model.updateOne({ _id: id }, { $set: { processedRows } }).exec();
  }

  async finish(id: string, summary: ImportSummary, rowErrors: readonly ImportRowError[], processedRows: number): Promise<void> {
    await this.model
      .updateOne(
        { _id: id },
        { $set: { status: 'DONE', summary, rowErrors: rowErrors.slice(0, MAX_IMPORT_ROW_ERRORS), processedRows, finishedAt: new Date() } },
      )
      .exec();
  }

  async fail(id: string, message: string): Promise<void> {
    await this.model
      .updateOne({ _id: id }, { $set: { status: 'FAILED', rowErrors: [{ row: 1, message }], finishedAt: new Date() } })
      .exec();
  }
}
