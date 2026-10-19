import type { CodReportDTO, DashboardDTO, SalesReportDTO, TopProductsReportDTO } from '@aricon/shared';
import { Controller, Get, Query, Req, type StreamableFile } from '@nestjs/common';
import { ApiOperation, ApiProduces, ApiTags } from '@nestjs/swagger';
import type { Request } from 'express';
import { AppError } from '../../common/errors/app-error.js';
import { ApiDataResponse, ApiErrorResponses } from '../../common/http/api-response.decorators.js';
import { RequirePermission, StaffOnly } from '../auth/auth.decorators.js';
import {
  CodReportDto,
  DashboardDto,
  ReportRangeQueryDto,
  SalesReportDto,
  SalesReportQueryDto,
  TopProductsQueryDto,
  TopProductsReportDto,
} from './dto/reports.dto.js';
import { xlsxDownload, XLSX_MIME } from '../spreadsheets/xlsx.js';
import { codSheets, salesSheets, topProductsSheets } from './reports.export.js';
import { ReportsService } from './reports.service.js';

/** SPEC §7.3 "Dashboard" and "Reports" (each report also as an Excel file, `reports.export`). */
@ApiTags('Admin · Dashboard & reports')
@Controller('admin')
export class ReportsController {
  constructor(private readonly reports: ReportsService) {}

  @Get('dashboard')
  @StaffOnly()
  @ApiOperation({ summary: 'Dashboard widgets — only the ones this staff member may see are present' })
  @ApiDataResponse(DashboardDto)
  @ApiErrorResponses(401)
  dashboard(@Req() req: Request): Promise<DashboardDTO> {
    if (!req.principal) throw AppError.unauthenticated();
    return this.reports.dashboard({ role: req.principal.role, permissions: req.principal.permissions });
  }

  @Get('reports/sales')
  @RequirePermission('reports.view')
  @ApiOperation({ summary: 'Orders, revenue and average order (cancelled/returned left out), by day or month' })
  @ApiDataResponse(SalesReportDto)
  @ApiErrorResponses(400, 401, 403)
  sales(@Query() query: SalesReportQueryDto): Promise<SalesReportDTO> {
    return this.reports.sales({ from: query.from, to: query.to }, query.groupBy ?? 'day');
  }

  @Get('reports/top-products')
  @RequirePermission('reports.view')
  @ApiOperation({ summary: 'Best-selling variants by quantity and by revenue' })
  @ApiDataResponse(TopProductsReportDto)
  @ApiErrorResponses(400, 401, 403)
  topProducts(@Query() query: TopProductsQueryDto): Promise<TopProductsReportDTO> {
    return this.reports.topProducts({ from: query.from, to: query.to }, query.limit ?? 20);
  }

  @Get('reports/cod')
  @RequirePermission('reports.view')
  @ApiOperation({ summary: 'Cash on delivery: collected vs still to collect, by rider and by day' })
  @ApiDataResponse(CodReportDto)
  @ApiErrorResponses(400, 401, 403)
  cod(@Query() query: ReportRangeQueryDto): Promise<CodReportDTO> {
    return this.reports.cod({ from: query.from, to: query.to });
  }

  @Get('reports/sales/export')
  @RequirePermission('reports.export')
  @ApiOperation({ summary: 'The sales report as an Excel file' })
  @ApiProduces(XLSX_MIME)
  @ApiErrorResponses(400, 401, 403)
  async salesExport(@Query() query: SalesReportQueryDto): Promise<StreamableFile> {
    const report = await this.reports.sales({ from: query.from, to: query.to }, query.groupBy ?? 'day');
    return xlsxDownload(`sales-${report.from}-to-${report.to}.xlsx`, salesSheets(report));
  }

  @Get('reports/top-products/export')
  @RequirePermission('reports.export')
  @ApiOperation({ summary: 'The top products report as an Excel file' })
  @ApiProduces(XLSX_MIME)
  @ApiErrorResponses(400, 401, 403)
  async topProductsExport(@Query() query: TopProductsQueryDto): Promise<StreamableFile> {
    const report = await this.reports.topProducts({ from: query.from, to: query.to }, query.limit ?? 20);
    return xlsxDownload(`top-products-${report.from}-to-${report.to}.xlsx`, topProductsSheets(report));
  }

  @Get('reports/cod/export')
  @RequirePermission('reports.export')
  @ApiOperation({ summary: 'The cash on delivery report as an Excel file' })
  @ApiProduces(XLSX_MIME)
  @ApiErrorResponses(400, 401, 403)
  async codExport(@Query() query: ReportRangeQueryDto): Promise<StreamableFile> {
    const report = await this.reports.cod({ from: query.from, to: query.to });
    return xlsxDownload(`cod-${report.from}-to-${report.to}.xlsx`, codSheets(report));
  }
}
