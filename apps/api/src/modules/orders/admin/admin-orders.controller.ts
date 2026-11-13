import {
  IDEMPOTENCY_HEADER,
  type AdminOrderDTO,
  type AdminOrderListItemDTO,
  type AdminOrderProductOptionDTO,
  type FileLinkDTO,
  type PricedCart,
} from '@aricon/shared';
import { Body, Controller, Get, HttpCode, Param, Patch, Post, Query, Req, Res, StreamableFile } from '@nestjs/common';
import { ApiHeader, ApiOperation, ApiProduces, ApiTags } from '@nestjs/swagger';
import type { Request, Response } from 'express';
import { AppError } from '../../../common/errors/app-error.js';
import { ApiDataResponse, ApiErrorResponses } from '../../../common/http/api-response.decorators.js';
import type { Paginated } from '../../../common/http/envelope.js';
import { ParseObjectIdPipe } from '../../../common/validation/parse-object-id.pipe.js';
import { CurrentActor, type AuditActor } from '../../audit/audit.service.js';
import { RequirePermission } from '../../auth/auth.decorators.js';
import { XLSX_MIME } from '../../spreadsheets/xlsx.js';
import type { AdminOrderFilters, AdminOrderSort } from './admin-orders.repository.js';
import { IdempotencyKey } from '../order-http.js';
import { InvoiceService } from '../invoice.service.js';
import { ReceiptsService } from '../receipts.service.js';
import { AdminOrderCreateService } from './admin-order-create.service.js';
import { AdminOrdersService } from './admin-orders.service.js';
import {
  AdminCreateOrderDto,
  AdminOrderDto,
  AdminOrderListItemDto,
  AdminOrderListQueryDto,
  AdminOrderProductOptionDto,
  AdminOrderQuoteDto,
  AdminOrderQuoteResultDto,
  AssignRiderDto,
  CodCollectedDto,
  FileLinkDto,
  InternalNoteDto,
  OrderStatusChangeDto,
  ProductOptionsQueryDto,
  RejectReceiptDto,
  StatusCountsDto,
} from './dto/admin-orders.dto.js';

const orderId = () => new ParseObjectIdPipe("We couldn't find that order.");
const receiptId = () => new ParseObjectIdPipe("We couldn't find that receipt.");

function filtersOf(query: AdminOrderListQueryDto): AdminOrderFilters {
  return {
    status: query.status,
    paymentStatus: query.paymentStatus,
    paymentMethod: query.paymentMethod,
    from: query.from,
    to: query.to,
    areaId: query.areaId,
    riderId: query.riderId,
    q: query.q,
  };
}

function parseSort(sort: string | undefined): AdminOrderSort {
  const [field = 'createdAt', direction = 'desc'] = (sort ?? 'createdAt:desc').split(':');
  if ((field === 'createdAt' || field === 'total' || field === 'orderNumber') && (direction === 'asc' || direction === 'desc')) {
    return { field, direction };
  }
  throw AppError.validation('Sort by createdAt, total or orderNumber (asc or desc).');
}

/** SPEC §7.3 "Orders". */
@ApiTags('Admin · Orders')
@Controller('admin/orders')
export class AdminOrdersController {
  constructor(
    private readonly orders: AdminOrdersService,
    private readonly creation: AdminOrderCreateService,
    private readonly receipts: ReceiptsService,
    private readonly invoices: InvoiceService,
  ) {}

  @Get()
  @RequirePermission('orders.view')
  @ApiOperation({ summary: 'Orders with filters; `statusCounts` gives the tab counts for the same filters' })
  @ApiDataResponse(AdminOrderListItemDto, { paginated: true, extra: { statusCounts: StatusCountsDto } })
  @ApiErrorResponses(400, 401, 403)
  list(@Query() query: AdminOrderListQueryDto): Promise<Paginated<AdminOrderListItemDTO>> {
    return this.orders.list(filtersOf(query), query.page, query.pageSize, parseSort(query.sort));
  }

  // Before ':id', so "export" isn't read as an order id.
  @Get('export')
  @RequirePermission('orders.export')
  @ApiOperation({ summary: 'The filtered orders as an Excel file (same filters as the list, no paging)' })
  @ApiProduces(XLSX_MIME)
  @ApiErrorResponses(400, 401, 403)
  export(@Query() query: AdminOrderListQueryDto): StreamableFile {
    return this.orders.export(filtersOf(query), parseSort(query.sort));
  }

  // Before ':id', so these paths aren't read as an order id.
  @Get('product-options')
  @RequirePermission('orders.create')
  @ApiOperation({ summary: 'Active product variants matching a name or SKU, for building an order' })
  @ApiDataResponse(AdminOrderProductOptionDto, { isArray: true })
  @ApiErrorResponses(400, 401, 403)
  productOptions(@Query() query: ProductOptionsQueryDto): Promise<AdminOrderProductOptionDTO[]> {
    return this.creation.productOptions(query.q ?? '');
  }

  @Post('quote')
  @RequirePermission('orders.create')
  @HttpCode(200)
  @ApiOperation({ summary: "Price an order for a customer's address without saving it" })
  @ApiDataResponse(AdminOrderQuoteResultDto)
  @ApiErrorResponses(400, 401, 403)
  quote(@Req() req: Request, @Body() body: AdminOrderQuoteDto): Promise<PricedCart & { discount: number }> {
    if (!req.principal) throw AppError.unauthenticated();
    return this.creation.quote(req.principal, body);
  }

  @Post()
  @RequirePermission('orders.create')
  @ApiOperation({
    summary: 'Create an order for a customer (same price, stock and payment rules as checkout)',
    description: '201 with the new order; 200 with the same order when the Idempotency-Key was already used.',
  })
  @ApiHeader({ name: IDEMPOTENCY_HEADER, required: true, description: 'A new UUID v4 per form.' })
  @ApiDataResponse(AdminOrderDto, { status: 201 })
  @ApiErrorResponses(400, 401, 403, 409)
  async create(
    @Req() req: Request,
    @CurrentActor() actor: AuditActor,
    @IdempotencyKey() idempotencyKey: string,
    @Body() body: AdminCreateOrderDto,
    @Res({ passthrough: true }) res: Response,
  ): Promise<AdminOrderDTO> {
    if (!req.principal) throw AppError.unauthenticated();
    const { order, created } = await this.creation.create(actor, req.principal, body, idempotencyKey);
    res.status(created ? 201 : 200);
    return order;
  }

  @Get(':id')
  @RequirePermission('orders.view')
  @ApiOperation({ summary: 'One order with customer, items, payment, rider and history' })
  @ApiDataResponse(AdminOrderDto)
  @ApiErrorResponses(401, 403, 404)
  detail(@Param('id', orderId()) id: string): Promise<AdminOrderDTO> {
    return this.orders.detail(id);
  }

  @Post(':id/status')
  @RequirePermission('orders.update_status')
  @HttpCode(200)
  @ApiOperation({ summary: 'Move the order along the status table; cancel/return also need orders.cancel' })
  @ApiDataResponse(AdminOrderDto)
  @ApiErrorResponses(400, 401, 403, 404, 409)
  changeStatus(
    @Req() req: Request,
    @CurrentActor() actor: AuditActor,
    @Param('id', orderId()) id: string,
    @Body() body: OrderStatusChangeDto,
  ): Promise<AdminOrderDTO> {
    if (!req.principal) throw AppError.unauthenticated();
    return this.orders.changeStatus(req.principal, actor, id, body);
  }

  @Post(':id/rider')
  @RequirePermission('orders.assign_rider')
  @HttpCode(200)
  @ApiOperation({ summary: 'Assign or change the rider (snapshot of name and phone)' })
  @ApiDataResponse(AdminOrderDto)
  @ApiErrorResponses(400, 401, 403, 404, 409)
  assignRider(@CurrentActor() actor: AuditActor, @Param('id', orderId()) id: string, @Body() body: AssignRiderDto): Promise<AdminOrderDTO> {
    return this.orders.assignRider(actor, id, body.riderId);
  }

  @Post(':id/cod-collected')
  @RequirePermission('orders.cod_collect')
  @HttpCode(200)
  @ApiOperation({ summary: 'Record cash collected (dispatched or delivered COD orders)' })
  @ApiDataResponse(AdminOrderDto)
  @ApiErrorResponses(400, 401, 403, 404, 409)
  codCollected(@CurrentActor() actor: AuditActor, @Param('id', orderId()) id: string, @Body() body: CodCollectedDto): Promise<AdminOrderDTO> {
    return this.orders.codCollected(actor, id, body.amount, body.note);
  }

  @Get(':id/invoice')
  @RequirePermission('orders.view')
  @ApiOperation({ summary: 'Order invoice (PDF)' })
  @ApiProduces('application/pdf')
  @ApiErrorResponses(401, 403, 404)
  async invoice(@Param('id', orderId()) id: string): Promise<StreamableFile> {
    const invoice = await this.invoices.render(await this.orders.findOrThrow(id));
    return new StreamableFile(invoice.body, { type: 'application/pdf', disposition: `attachment; filename="${invoice.fileName}"` });
  }

  @Get(':id/receipts/:receiptId/url')
  @RequirePermission('orders.view')
  @ApiOperation({ summary: 'A 10-minute link to a receipt file' })
  @ApiDataResponse(FileLinkDto)
  @ApiErrorResponses(401, 403, 404)
  receiptUrl(@Param('id', orderId()) id: string, @Param('receiptId', receiptId()) receipt: string): Promise<FileLinkDTO> {
    return this.receipts.staffLink(id, receipt);
  }

  @Post(':id/receipts/:receiptId/approve')
  @RequirePermission('orders.verify_payment')
  @HttpCode(200)
  @ApiOperation({ summary: 'Approve a bank-transfer receipt (order becomes paid)' })
  @ApiDataResponse(AdminOrderDto)
  @ApiErrorResponses(401, 403, 404, 409)
  approveReceipt(
    @CurrentActor() actor: AuditActor,
    @Param('id', orderId()) id: string,
    @Param('receiptId', receiptId()) receipt: string,
  ): Promise<AdminOrderDTO> {
    return this.orders.approveReceipt(actor, id, receipt);
  }

  @Post(':id/receipts/:receiptId/reject')
  @RequirePermission('orders.verify_payment')
  @HttpCode(200)
  @ApiOperation({ summary: 'Reject a receipt with a reason (the customer can upload again)' })
  @ApiDataResponse(AdminOrderDto)
  @ApiErrorResponses(400, 401, 403, 404, 409)
  rejectReceipt(
    @CurrentActor() actor: AuditActor,
    @Param('id', orderId()) id: string,
    @Param('receiptId', receiptId()) receipt: string,
    @Body() body: RejectReceiptDto,
  ): Promise<AdminOrderDTO> {
    return this.orders.rejectReceipt(actor, id, receipt, body.reason);
  }

  @Patch(':id/internal-note')
  @RequirePermission('orders.update_status')
  @ApiOperation({ summary: 'Staff-only note on the order' })
  @ApiDataResponse(AdminOrderDto)
  @ApiErrorResponses(400, 401, 403, 404)
  internalNote(@CurrentActor() actor: AuditActor, @Param('id', orderId()) id: string, @Body() body: InternalNoteDto): Promise<AdminOrderDTO> {
    return this.orders.setInternalNote(actor, id, body.internalNote);
  }
}
