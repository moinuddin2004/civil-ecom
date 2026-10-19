import {
  type CodReportDTO,
  type DashboardDTO,
  type OrderStatus,
  type SalesReportDTO,
  type TopProductsReportDTO,
} from '@aricon/shared';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsIn, IsInt, IsOptional, Max, Min } from 'class-validator';
import { IsOptionalDateKey } from '../../../common/validation/validators.js';
import { AdminOrderListItemDto, StatusCountsDto } from '../../orders/admin/dto/admin-orders.dto.js';

/* Dashboard and reports (SPEC §7.3 "Dashboard", "Reports"). Dates are Karachi calendar dates. */

export class ReportRangeQueryDto {
  @ApiPropertyOptional({ example: '2026-09-01', description: 'Default: 29 days before `to`.' })
  @IsOptionalDateKey()
  from?: string;

  @ApiPropertyOptional({ example: '2026-09-30', description: 'Default: today (Karachi).' })
  @IsOptionalDateKey()
  to?: string;
}

export class SalesReportQueryDto extends ReportRangeQueryDto {
  @ApiPropertyOptional({ enum: ['day', 'month'], default: 'day' })
  @IsOptional()
  @IsIn(['day', 'month'], { message: 'Group by day or month.' })
  groupBy?: 'day' | 'month';
}

export class TopProductsQueryDto extends ReportRangeQueryDto {
  @ApiPropertyOptional({ minimum: 1, maximum: 100, default: 20 })
  @IsOptional()
  @Type(() => Number)
  @IsInt({ message: 'Use a whole number.' })
  @Min(1)
  @Max(100)
  limit?: number;
}

class TotalsDto {
  @ApiProperty() orders!: number;
  @ApiProperty() revenue!: number;
}

class DailySalesDto extends TotalsDto {
  @ApiProperty({ example: '2026-09-26' }) date!: string;
}

class SalesWidgetDto {
  @ApiProperty({ type: TotalsDto }) today!: TotalsDto;
  @ApiProperty({ type: TotalsDto }) last7Days!: TotalsDto;
  @ApiProperty({ type: TotalsDto }) last30Days!: TotalsDto;
  @ApiProperty({ type: [DailySalesDto] }) series!: DailySalesDto[];
}

class ReceiptsWidgetDto {
  @ApiProperty() count!: number;
  @ApiProperty({ type: [AdminOrderListItemDto], description: 'Oldest first.' }) orders!: AdminOrderListItemDto[];
}

class CodWidgetDto {
  @ApiProperty() count!: number;
  @ApiProperty() amount!: number;
}

class LowStockItemDto {
  @ApiProperty() productId!: string;
  @ApiProperty() productName!: string;
  @ApiProperty() variantId!: string;
  @ApiProperty() sku!: string;
  @ApiProperty() variantLabel!: string;
  @ApiProperty() stock!: number;
  @ApiProperty() threshold!: number;
}

class LowStockWidgetDto {
  @ApiProperty() count!: number;
  @ApiProperty({ type: [LowStockItemDto] }) items!: LowStockItemDto[];
}

export class DashboardDto implements DashboardDTO {
  @ApiPropertyOptional({ type: SalesWidgetDto, description: 'dashboard.view' }) sales?: SalesWidgetDto;
  @ApiPropertyOptional({ type: StatusCountsDto, description: 'orders.view (no `all`)' }) ordersByStatus?: Record<OrderStatus, number>;
  @ApiPropertyOptional({ type: ReceiptsWidgetDto, description: 'orders.verify_payment' }) receiptsToVerify?: ReceiptsWidgetDto;
  @ApiPropertyOptional({ type: CodWidgetDto, description: 'orders.cod_collect or dashboard.view' }) codToCollect?: CodWidgetDto;
  @ApiPropertyOptional({ type: LowStockWidgetDto, description: 'products.view' }) lowStock?: LowStockWidgetDto;
}

class SalesPointDto extends TotalsDto {
  @ApiProperty({ example: '2026-09-26', description: 'YYYY-MM-DD or YYYY-MM.' }) period!: string;
}

class SalesTotalsDto extends TotalsDto {
  @ApiProperty({ description: 'Revenue ÷ orders, whole rupees.' }) averageOrder!: number;
}

export class SalesReportDto implements SalesReportDTO {
  @ApiProperty() from!: string;
  @ApiProperty() to!: string;
  @ApiProperty({ enum: ['day', 'month'] }) groupBy!: 'day' | 'month';
  @ApiProperty({ type: SalesTotalsDto }) totals!: SalesTotalsDto;
  @ApiProperty({ type: [SalesPointDto], description: 'Every period in the range, zeros included.' }) series!: SalesPointDto[];
}

class ProductSalesDto {
  @ApiProperty() productId!: string;
  @ApiProperty() productName!: string;
  @ApiProperty() sku!: string;
  @ApiProperty() qty!: number;
  @ApiProperty() revenue!: number;
}

export class TopProductsReportDto implements TopProductsReportDTO {
  @ApiProperty() from!: string;
  @ApiProperty() to!: string;
  @ApiProperty({ type: [ProductSalesDto] }) byQuantity!: ProductSalesDto[];
  @ApiProperty({ type: [ProductSalesDto] }) byRevenue!: ProductSalesDto[];
}

class CodTotalsDto {
  @ApiProperty() collected!: number;
  @ApiProperty() pending!: number;
  @ApiProperty() collectedOrders!: number;
  @ApiProperty() pendingOrders!: number;
}

class CodRiderDto {
  @ApiProperty({ type: String, nullable: true }) riderId!: string | null;
  @ApiProperty() riderName!: string;
  @ApiProperty() collected!: number;
  @ApiProperty() pending!: number;
}

class CodDayDto {
  @ApiProperty() date!: string;
  @ApiProperty() collected!: number;
  @ApiProperty() pending!: number;
}

export class CodReportDto implements CodReportDTO {
  @ApiProperty() from!: string;
  @ApiProperty() to!: string;
  @ApiProperty({ type: CodTotalsDto }) totals!: CodTotalsDto;
  @ApiProperty({ type: [CodRiderDto] }) byRider!: CodRiderDto[];
  @ApiProperty({ type: [CodDayDto] }) byDay!: CodDayDto[];
}
