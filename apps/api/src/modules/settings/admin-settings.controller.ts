import type { AdminSettingsDTO } from '@aricon/shared';
import { Body, Controller, Get, Put } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { ApiDataResponse, ApiErrorResponses } from '../../common/http/api-response.decorators.js';
import { CurrentActor, type AuditActor } from '../audit/audit.service.js';
import { RequireAdmin } from '../auth/auth.decorators.js';
import { AdminSettingsService } from './admin-settings.service.js';
import { AdminSettingsDto, UpdateSettingsDto } from './dto/admin-settings.dto.js';

/** SPEC §7.3: store settings, ADMIN only. */
@ApiTags('Admin · Settings')
@RequireAdmin()
@Controller('admin/settings')
export class AdminSettingsController {
  constructor(private readonly settings: AdminSettingsService) {}

  @Get()
  @ApiOperation({ summary: 'Store settings (defaults until first saved)' })
  @ApiDataResponse(AdminSettingsDto)
  @ApiErrorResponses(401, 403)
  get(): Promise<AdminSettingsDTO> {
    return this.settings.get();
  }

  @Put()
  @ApiOperation({ summary: 'Replace the store settings (audited; refreshes the storefront)' })
  @ApiDataResponse(AdminSettingsDto)
  @ApiErrorResponses(400, 401, 403)
  update(@CurrentActor() actor: AuditActor, @Body() body: UpdateSettingsDto): Promise<AdminSettingsDTO> {
    return this.settings.update(actor, body);
  }
}
