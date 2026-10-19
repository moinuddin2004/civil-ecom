import { IDEMPOTENCY_HEADER, RECEIPT_UPLOAD_MAX_BYTES, type CustomerOrderDTO, type CustomerOrderListItemDTO, type ReorderResultDTO } from '@aricon/shared';
import { Body, Controller, Get, HttpCode, Param, Post, Query, Res, StreamableFile, UploadedFile } from '@nestjs/common';
import { ApiCookieAuth, ApiHeader, ApiOperation, ApiProduces, ApiTags } from '@nestjs/swagger';
import { hours, Throttle } from '@nestjs/throttler';
import type { Response } from 'express';
import { ApiDataResponse, ApiErrorResponses } from '../../common/http/api-response.decorators.js';
import { FileUpload } from '../../common/http/file-upload.decorator.js';
import type { Paginated } from '../../common/http/envelope.js';
import { PaginationQueryDto } from '../../common/http/pagination.dto.js';
import { CurrentUser, CustomerOnly } from '../auth/auth.decorators.js';
import type { Principal } from '../auth/auth.types.js';
import { CustomerOrdersService } from './customer-orders.service.js';
import { CancelOrderDto, PlaceOrderDto } from './dto/order.request.dto.js';
import { CustomerOrderDto, CustomerOrderListItemDto, ReorderResultDto } from './dto/order.response.dto.js';
import { IdempotencyKey, ParseOrderNumberPipe } from './order-http.js';
import { OrderPlacementService } from './order-placement.service.js';
import { InvoiceService } from './invoice.service.js';
import { ReceiptsService } from './receipts.service.js';
import type { UploadedFileInput } from '../storage/file-processing.service.js';

/** Customer orders (SPEC §7.2 "Orders (customer)"). Another customer's order is always a 404. */
@ApiTags('Orders')
@ApiCookieAuth('customer')
@CustomerOnly()
@Controller('orders')
export class CustomerOrdersController {
  constructor(
    private readonly placement: OrderPlacementService,
    private readonly orders: CustomerOrdersService,
    private readonly receipts: ReceiptsService,
    private readonly invoices: InvoiceService,
  ) {}

  @Post()
  @ApiOperation({
    summary: 'Place an order from the cart',
    description: '201 with the new order; 200 with the same order when the Idempotency-Key was already used.',
  })
  @ApiHeader({ name: IDEMPOTENCY_HEADER, required: true, description: 'A new UUID v4 per checkout.' })
  @ApiDataResponse(CustomerOrderDto, { status: 201 })
  @ApiErrorResponses(400, 401, 409)
  async place(
    @CurrentUser() user: Principal,
    @IdempotencyKey() idempotencyKey: string,
    @Body() body: PlaceOrderDto,
    @Res({ passthrough: true }) res: Response,
  ): Promise<CustomerOrderDTO> {
    const { order, created } = await this.placement.place(user.userId, body, idempotencyKey);
    res.status(created ? 201 : 200);
    return this.orders.toDto(order);
  }

  @Get()
  @ApiOperation({ summary: 'Your orders, newest first' })
  @ApiDataResponse(CustomerOrderListItemDto, { paginated: true })
  @ApiErrorResponses(400, 401)
  list(@CurrentUser() user: Principal, @Query() query: PaginationQueryDto): Promise<Paginated<CustomerOrderListItemDTO>> {
    return this.orders.list(user.userId, query.page, query.pageSize);
  }

  @Get(':orderNumber')
  @ApiOperation({ summary: 'One of your orders' })
  @ApiDataResponse(CustomerOrderDto)
  @ApiErrorResponses(401, 404)
  detail(
    @CurrentUser() user: Principal,
    @Param('orderNumber', ParseOrderNumberPipe) orderNumber: string,
  ): Promise<CustomerOrderDTO> {
    return this.orders.detail(user.userId, orderNumber);
  }

  @Get(':orderNumber/invoice')
  @ApiOperation({ summary: 'Invoice for one of your orders (PDF)' })
  @ApiProduces('application/pdf')
  @ApiErrorResponses(401, 404)
  async invoice(@CurrentUser() user: Principal, @Param('orderNumber', ParseOrderNumberPipe) orderNumber: string): Promise<StreamableFile> {
    const invoice = await this.invoices.render(await this.orders.findOwnOrThrow(user.userId, orderNumber));
    return new StreamableFile(invoice.body, { type: 'application/pdf', disposition: `attachment; filename="${invoice.fileName}"` });
  }

  @Post(':orderNumber/cancel')
  @HttpCode(200)
  @ApiOperation({ summary: 'Cancel your order while it is new (stock is returned)' })
  @ApiDataResponse(CustomerOrderDto)
  @ApiErrorResponses(400, 401, 404, 409)
  cancel(
    @CurrentUser() user: Principal,
    @Param('orderNumber', ParseOrderNumberPipe) orderNumber: string,
    @Body() body: CancelOrderDto,
  ): Promise<CustomerOrderDTO> {
    return this.orders.cancel(user.userId, orderNumber, body.reason);
  }

  @Post(':orderNumber/receipts')
  @HttpCode(201)
  @Throttle({ default: { limit: 10, ttl: hours(1) } })
  @FileUpload(RECEIPT_UPLOAD_MAX_BYTES)
  @ApiOperation({ summary: 'Upload a bank-transfer receipt (JPG, PNG, WebP or PDF up to 5 MB)' })
  @ApiDataResponse(CustomerOrderDto, { status: 201 })
  @ApiErrorResponses(400, 401, 404, 409, 413, 415, 429)
  uploadReceipt(
    @CurrentUser() user: Principal,
    @Param('orderNumber', ParseOrderNumberPipe) orderNumber: string,
    @UploadedFile() file: UploadedFileInput | undefined,
  ): Promise<CustomerOrderDTO> {
    return this.receipts.upload(user.userId, orderNumber, file);
  }

  @Post(':orderNumber/reorder')
  @HttpCode(200)
  @ApiOperation({ summary: 'Add the items of a past order to your cart' })
  @ApiDataResponse(ReorderResultDto)
  @ApiErrorResponses(401, 404)
  reorder(
    @CurrentUser() user: Principal,
    @Param('orderNumber', ParseOrderNumberPipe) orderNumber: string,
  ): Promise<ReorderResultDTO> {
    return this.orders.reorder(user.userId, orderNumber);
  }
}
