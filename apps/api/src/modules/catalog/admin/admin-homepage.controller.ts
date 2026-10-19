import type { AdminHomepageDTO } from '@aricon/shared';
import { Body, Controller, Get, Put } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { ApiDataResponse, ApiErrorResponses } from '../../../common/http/api-response.decorators.js';
import { CurrentActor, type AuditActor } from '../../audit/audit.service.js';
import { RequirePermission } from '../../auth/auth.decorators.js';
import { AdminHomepageService } from './admin-homepage.service.js';
import { AdminHomepageDto, UpdateHomepageDto } from './dto/admin-homepage.dto.js';

/** SPEC §7.3 "Homepage". */
@ApiTags('Admin · Homepage')
@RequirePermission('homepage.manage')
@Controller('admin/homepage')
export class AdminHomepageController {
  constructor(private readonly homepage: AdminHomepageService) {}

  @Get()
  @ApiOperation({ summary: 'Banners, featured products and deals' })
  @ApiDataResponse(AdminHomepageDto)
  @ApiErrorResponses(401, 403)
  get(): Promise<AdminHomepageDTO> {
    return this.homepage.get();
  }

  @Put()
  @ApiOperation({ summary: 'Replace the homepage content (audited; refreshes the home page)' })
  @ApiDataResponse(AdminHomepageDto)
  @ApiErrorResponses(400, 401, 403)
  update(@CurrentActor() actor: AuditActor, @Body() body: UpdateHomepageDto): Promise<AdminHomepageDTO> {
    return this.homepage.update(actor, body);
  }
}
