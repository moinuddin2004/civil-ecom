import { Module } from '@nestjs/common';
import { ReportsController } from './reports.controller.js';
import { ReportsRepository } from './reports.repository.js';
import { ReportsService } from './reports.service.js';

/** Dashboard and reports (SPEC §10.3, §10.11): read-only aggregations. */
@Module({
  controllers: [ReportsController],
  providers: [ReportsRepository, ReportsService],
})
export class ReportsModule {}
