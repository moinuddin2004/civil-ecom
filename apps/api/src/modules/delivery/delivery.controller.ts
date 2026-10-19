import type { DeliveryAreaDTO } from '@aricon/shared';
import { Controller, Get } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { ApiDataResponse } from '../../common/http/api-response.decorators.js';
import { Public } from '../auth/auth.decorators.js';
import { DeliveryService } from './delivery.service.js';
import { DeliveryAreaDto } from './dto/delivery.response.dto.js';

@ApiTags('Store')
@Public()
@Controller('delivery-areas')
export class DeliveryController {
  constructor(private readonly delivery: DeliveryService) {}

  @Get()
  @ApiOperation({ summary: 'All delivery areas with their fee and free-delivery threshold' })
  @ApiDataResponse(DeliveryAreaDto, { isArray: true })
  list(): Promise<DeliveryAreaDTO[]> {
    return this.delivery.publicAreas();
  }
}
