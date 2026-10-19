import type { AuditLogDTO } from '@aricon/shared';
import { Controller, Get, Query } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { ApiDataResponse, ApiErrorResponses } from '../../common/http/api-response.decorators.js';
import type { Paginated } from '../../common/http/envelope.js';
import { RequireAdmin } from '../auth/auth.decorators.js';
import { AuditLogDto, AuditLogQueryDto } from './audit-logs.dto.js';
import { AuditLogsService } from './audit-logs.service.js';

/** SPEC §7.3: the audit trail, ADMIN only. Read-only — entries are never edited or deleted. */
@ApiTags('Admin · Audit log')
@RequireAdmin()
@Controller('admin/audit-logs')
export class AuditLogsController {
  constructor(private readonly logs: AuditLogsService) {}

  @Get()
  @ApiOperation({ summary: 'Who changed what and when, newest first' })
  @ApiDataResponse(AuditLogDto, { paginated: true })
  @ApiErrorResponses(400, 401, 403)
  list(@Query() query: AuditLogQueryDto): Promise<Paginated<AuditLogDTO>> {
    return this.logs.list(query);
  }
}
