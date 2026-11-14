import type {
  PermissionCatalogDTO,
  StaffDTO,
  TemporaryPasswordDTO,
} from '@aricon/shared';
import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  Patch,
  Post,
} from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import {
  ApiDataResponse,
  ApiErrorResponses,
} from '../../common/http/api-response.decorators.js';
import { ParseObjectIdPipe } from '../../common/validation/parse-object-id.pipe.js';
import { CurrentActor, type AuditActor } from '../audit/audit.service.js';
import { RequireAdmin, StaffOnly } from '../auth/auth.decorators.js';
import {
  CreateStaffDto,
  PermissionCatalogResponseDto,
  StaffResponseDto,
  TemporaryPasswordResponseDto,
  UpdateStaffDto,
} from './dto/staff.dto.js';
import { StaffService } from './staff.service.js';

const staffId = () =>
  new ParseObjectIdPipe("We couldn't find that staff member.");

/** SPEC §7.3 "Staff, permissions": staff accounts are ADMIN-only; the catalog is for any staff. */
@ApiTags('Admin · Staff')
@Controller('admin')
export class StaffController {
  constructor(private readonly staff: StaffService) {}

  @Get('permissions')
  @StaffOnly()
  @ApiOperation({
    summary:
      'Permission catalog, groups, dependencies, sensitive flags and presets (for the UI)',
  })
  @ApiDataResponse(PermissionCatalogResponseDto)
  @ApiErrorResponses(401)
  permissions(): PermissionCatalogDTO {
    return this.staff.catalog();
  }

  @Get('staff')
  @RequireAdmin()
  @ApiOperation({ summary: 'All staff and admins' })
  @ApiDataResponse(StaffResponseDto, { isArray: true })
  @ApiErrorResponses(401, 403)
  list(): Promise<StaffDTO[]> {
    return this.staff.list();
  }

  @Post('staff')
  @RequireAdmin()
  @ApiOperation({
    summary: 'Add a staff member; returns a temporary password once',
  })
  @ApiDataResponse(TemporaryPasswordResponseDto, { status: 201 })
  @ApiErrorResponses(400, 401, 403, 409)
  create(
    @CurrentActor() actor: AuditActor,
    @Body() body: CreateStaffDto,
  ): Promise<TemporaryPasswordDTO> {
    return this.staff.create(actor, body);
  }

  @Patch('staff/:id')
  @RequireAdmin()
  @ApiOperation({
    summary:
      'Edit name, phone, role, permissions or status (last-admin and self rules apply)',
  })
  @ApiDataResponse(StaffResponseDto)
  @ApiErrorResponses(400, 401, 403, 404, 409)
  update(
    @CurrentActor() actor: AuditActor,
    @Param('id', staffId()) id: string,
    @Body() body: UpdateStaffDto,
  ): Promise<StaffDTO> {
    return this.staff.update(actor, id, body);
  }

  @Post('staff/:id/reset-password')
  @RequireAdmin()
  @HttpCode(200)
  @ApiOperation({
    summary: 'Reset a staff password; returns a new temporary password once',
  })
  @ApiDataResponse(TemporaryPasswordResponseDto)
  @ApiErrorResponses(401, 403, 404)
  resetPassword(
    @CurrentActor() actor: AuditActor,
    @Param('id', staffId()) id: string,
  ): Promise<TemporaryPasswordDTO> {
    return this.staff.resetPassword(actor, id);
  }

  @Post('staff/:id/verify-email')
  @RequireAdmin()
  @HttpCode(200)
  @ApiOperation({
    summary:
      'Mark a staff member’s email as verified (when the verification email cannot be delivered)',
  })
  @ApiDataResponse(StaffResponseDto)
  @ApiErrorResponses(401, 403, 404)
  verifyEmail(
    @CurrentActor() actor: AuditActor,
    @Param('id', staffId()) id: string,
  ): Promise<StaffDTO> {
    return this.staff.verifyEmail(actor, id);
  }

  @Delete('staff/:id')
  @RequireAdmin()
  @HttpCode(200)
  @ApiOperation({
    summary:
      'Soft-delete a staff member; their order and audit history remains',
  })
  @ApiDataResponse(StaffResponseDto)
  @ApiErrorResponses(401, 403, 404, 409)
  delete(
    @CurrentActor() actor: AuditActor,
    @Param('id', staffId()) id: string,
  ): Promise<StaffDTO> {
    return this.staff.delete(actor, id);
  }

  @Post('staff/:id/restore')
  @RequireAdmin()
  @HttpCode(200)
  @ApiOperation({ summary: 'Restore a soft-deleted staff member' })
  @ApiDataResponse(StaffResponseDto)
  @ApiErrorResponses(401, 403, 404)
  restore(
    @CurrentActor() actor: AuditActor,
    @Param('id', staffId()) id: string,
  ): Promise<StaffDTO> {
    return this.staff.restore(actor, id);
  }
}
