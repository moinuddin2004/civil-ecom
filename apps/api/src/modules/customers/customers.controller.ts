import type { AdminCustomerDetailDTO, AdminCustomerListItemDTO } from '@aricon/shared';
import { Body, Controller, Get, HttpCode, Param, Post, Query, type StreamableFile } from '@nestjs/common';
import { ApiOperation, ApiProduces, ApiTags } from '@nestjs/swagger';
import { ApiDataResponse, ApiErrorResponses } from '../../common/http/api-response.decorators.js';
import type { Paginated } from '../../common/http/envelope.js';
import { ParseObjectIdPipe } from '../../common/validation/parse-object-id.pipe.js';
import { CurrentActor, type AuditActor } from '../audit/audit.service.js';
import { RequirePermission } from '../auth/auth.decorators.js';
import { XLSX_MIME } from '../spreadsheets/xlsx.js';
import { CustomersService } from './customers.service.js';
import {
  AdminCustomerDetailDto,
  AdminCustomerListItemDto,
  CustomerListQueryDto,
  CustomerStatusNoteDto,
} from './dto/customers.dto.js';

const customerId = () => new ParseObjectIdPipe("We couldn't find that customer.");

/** SPEC §7.3 "Customers". */
@ApiTags('Admin · Customers')
@Controller('admin/customers')
export class CustomersController {
  constructor(private readonly customers: CustomersService) {}

  @Get()
  @RequirePermission('customers.view')
  @ApiOperation({ summary: 'Customers with order count and total spent; search by name, email or phone' })
  @ApiDataResponse(AdminCustomerListItemDto, { paginated: true })
  @ApiErrorResponses(400, 401, 403)
  list(@Query() query: CustomerListQueryDto): Promise<Paginated<AdminCustomerListItemDTO>> {
    return this.customers.list({ q: query.q, status: query.status }, query.page, query.pageSize);
  }

  // Before ':id', so "export" isn't read as a customer id.
  @Get('export')
  @RequirePermission('customers.export')
  @ApiOperation({ summary: 'The filtered customers as an Excel file' })
  @ApiProduces(XLSX_MIME)
  @ApiErrorResponses(400, 401, 403)
  export(@Query() query: CustomerListQueryDto): StreamableFile {
    return this.customers.export({ q: query.q, status: query.status });
  }

  @Get(':id')
  @RequirePermission('customers.view')
  @ApiOperation({ summary: 'Profile, addresses and recent orders' })
  @ApiDataResponse(AdminCustomerDetailDto)
  @ApiErrorResponses(401, 403, 404)
  detail(@Param('id', customerId()) id: string): Promise<AdminCustomerDetailDTO> {
    return this.customers.detail(id);
  }

  @Post(':id/block')
  @RequirePermission('customers.block')
  @HttpCode(200)
  @ApiOperation({ summary: 'Block a customer (signs them out everywhere)' })
  @ApiDataResponse(AdminCustomerDetailDto)
  @ApiErrorResponses(400, 401, 403, 404)
  block(
    @CurrentActor() actor: AuditActor,
    @Param('id', customerId()) id: string,
    @Body() body: CustomerStatusNoteDto,
  ): Promise<AdminCustomerDetailDTO> {
    return this.customers.setStatus(actor, id, 'blocked', body.note);
  }

  @Post(':id/unblock')
  @RequirePermission('customers.block')
  @HttpCode(200)
  @ApiOperation({ summary: 'Unblock a customer' })
  @ApiDataResponse(AdminCustomerDetailDto)
  @ApiErrorResponses(400, 401, 403, 404)
  unblock(
    @CurrentActor() actor: AuditActor,
    @Param('id', customerId()) id: string,
    @Body() body: CustomerStatusNoteDto,
  ): Promise<AdminCustomerDetailDTO> {
    return this.customers.setStatus(actor, id, 'active', body.note);
  }
}
