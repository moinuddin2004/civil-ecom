import type { AdminDeliveryAreaDTO, RiderDTO } from '@aricon/shared';
import { Body, Controller, Get, Param, Patch, Post } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { ApiDataResponse, ApiErrorResponses } from '../../common/http/api-response.decorators.js';
import { ParseObjectIdPipe } from '../../common/validation/parse-object-id.pipe.js';
import { CurrentActor, type AuditActor } from '../audit/audit.service.js';
import { RequireAnyPermission, RequirePermission } from '../auth/auth.decorators.js';
import { AdminDeliveryService } from './admin-delivery.service.js';
import {
  AdminDeliveryAreaDto,
  CreateDeliveryAreaDto,
  CreateRiderDto,
  RiderDto,
  UpdateDeliveryAreaDto,
  UpdateRiderDto,
} from './dto/admin-delivery.dto.js';

const areaId = () => new ParseObjectIdPipe("We couldn't find that delivery area.");
const riderId = () => new ParseObjectIdPipe("We couldn't find that rider.");

/** SPEC §7.3 "Delivery". */
@ApiTags('Admin · Delivery')
@Controller('admin')
export class AdminDeliveryController {
  constructor(private readonly delivery: AdminDeliveryService) {}

  @Get('delivery-areas')
  @RequirePermission('delivery_areas.manage')
  @ApiOperation({ summary: 'All delivery areas (a short, fixed list — not paginated)' })
  @ApiDataResponse(AdminDeliveryAreaDto, { isArray: true })
  @ApiErrorResponses(401, 403)
  listAreas(): Promise<AdminDeliveryAreaDTO[]> {
    return this.delivery.listAreas();
  }

  @Post('delivery-areas')
  @RequirePermission('delivery_areas.manage')
  @ApiOperation({ summary: 'Add a delivery area' })
  @ApiDataResponse(AdminDeliveryAreaDto, { status: 201 })
  @ApiErrorResponses(400, 401, 403, 409)
  createArea(@CurrentActor() actor: AuditActor, @Body() body: CreateDeliveryAreaDto): Promise<AdminDeliveryAreaDTO> {
    return this.delivery.createArea(actor, body);
  }

  @Patch('delivery-areas/:id')
  @RequirePermission('delivery_areas.manage')
  @ApiOperation({ summary: 'Edit a delivery area (switch off with isServiceable: false)' })
  @ApiDataResponse(AdminDeliveryAreaDto)
  @ApiErrorResponses(400, 401, 403, 404, 409)
  updateArea(
    @CurrentActor() actor: AuditActor,
    @Param('id', areaId()) id: string,
    @Body() body: UpdateDeliveryAreaDto,
  ): Promise<AdminDeliveryAreaDTO> {
    return this.delivery.updateArea(actor, id, body);
  }

  @Get('riders')
  @RequireAnyPermission('riders.manage', 'orders.assign_rider')
  @ApiOperation({ summary: 'All riders, active first' })
  @ApiDataResponse(RiderDto, { isArray: true })
  @ApiErrorResponses(401, 403)
  listRiders(): Promise<RiderDTO[]> {
    return this.delivery.listRiders();
  }

  @Post('riders')
  @RequirePermission('riders.manage')
  @ApiOperation({ summary: 'Add a rider' })
  @ApiDataResponse(RiderDto, { status: 201 })
  @ApiErrorResponses(400, 401, 403)
  createRider(@CurrentActor() actor: AuditActor, @Body() body: CreateRiderDto): Promise<RiderDTO> {
    return this.delivery.createRider(actor, body);
  }

  @Patch('riders/:id')
  @RequirePermission('riders.manage')
  @ApiOperation({ summary: 'Edit or deactivate a rider' })
  @ApiDataResponse(RiderDto)
  @ApiErrorResponses(400, 401, 403, 404)
  updateRider(@CurrentActor() actor: AuditActor, @Param('id', riderId()) id: string, @Body() body: UpdateRiderDto): Promise<RiderDTO> {
    return this.delivery.updateRider(actor, id, body);
  }
}
