import { IMPORT_JOB_STATUSES, type ImportJobDTO, type ImportJobStatus } from '@aricon/shared';
import { ApiProperty } from '@nestjs/swagger';

export class ImportStartedDto {
  @ApiProperty({ description: 'Follow it at GET /api/admin/import-jobs/{jobId}.' }) jobId!: string;
}

class ImportSummaryDto {
  @ApiProperty() created!: number;
  @ApiProperty() updated!: number;
  @ApiProperty() failed!: number;
}

class ImportRowErrorDto {
  @ApiProperty({ description: 'Excel row number.' }) row!: number;
  @ApiProperty({ type: String, nullable: true }) sku!: string | null;
  @ApiProperty() message!: string;
}

export class ImportJobDto implements ImportJobDTO {
  @ApiProperty() id!: string;
  @ApiProperty({ enum: IMPORT_JOB_STATUSES }) status!: ImportJobStatus;
  @ApiProperty() totalRows!: number;
  @ApiProperty() processedRows!: number;
  @ApiProperty({ type: ImportSummaryDto }) summary!: ImportSummaryDto;
  @ApiProperty({ type: [ImportRowErrorDto], description: 'At most 500; photos that could not be added are listed too.' })
  errors!: ImportRowErrorDto[];
  @ApiProperty({ format: 'date-time' }) createdAt!: string;
  @ApiProperty({ type: String, format: 'date-time', nullable: true }) startedAt!: string | null;
  @ApiProperty({ type: String, format: 'date-time', nullable: true }) finishedAt!: string | null;
}
