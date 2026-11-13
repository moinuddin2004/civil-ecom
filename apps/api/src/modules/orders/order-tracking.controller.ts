import type { OrderTrackingDTO } from '@aricon/shared';
import { Body, Controller, HttpCode, Post } from '@nestjs/common';
import { ApiOperation, ApiProperty, ApiTags } from '@nestjs/swagger';
import { minutes, Throttle } from '@nestjs/throttler';
import { Matches } from 'class-validator';
import { ApiDataResponse, ApiErrorResponses } from '../../common/http/api-response.decorators.js';
import { Public } from '../auth/auth.decorators.js';
import { OrderTrackingService } from './order-tracking.service.js';

/** `POST /api/public/track-order`; mirrors `trackOrderSchema`. */
export class TrackOrderDto {
  @ApiProperty({ example: '482915', description: 'The 6-digit tracking code of the order.' })
  @Matches(/^\d{6}$/, { message: 'Enter the 6-digit tracking code.' })
  code!: string;
}

export class OrderTrackingDto implements OrderTrackingDTO {
  @ApiProperty() orderNumber!: string;
  @ApiProperty() status!: OrderTrackingDTO['status'];
  @ApiProperty() createdAt!: string;
  @ApiProperty() history!: OrderTrackingDTO['history'];
  @ApiProperty({ type: String, nullable: true }) riderName!: string | null;
}

/** Track an order without signing in (SPEC §6.6b). Same-origin only: the Origin check stays on. */
@ApiTags('Public')
@Public()
@Controller('public')
export class OrderTrackingController {
  constructor(private readonly tracking: OrderTrackingService) {}

  @Post('track-order')
  @HttpCode(200)
  @Throttle({ default: { limit: 10, ttl: minutes(15) } })
  @ApiOperation({ summary: 'Status of an order, from its 6-digit tracking code' })
  @ApiDataResponse(OrderTrackingDto)
  @ApiErrorResponses(400, 404, 429)
  track(@Body() body: TrackOrderDto): Promise<OrderTrackingDTO> {
    return this.tracking.track(body.code);
  }
}
