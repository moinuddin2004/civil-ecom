import { IMPORT_UPLOAD_MAX_BYTES, type AdminProductDTO, type AdminProductListItemDTO, type ImportJobDTO, type StockMovementDTO } from '@aricon/shared';
import { Body, Controller, Get, HttpCode, Param, Patch, Post, Query, Req, UploadedFile, type StreamableFile } from '@nestjs/common';
import { ApiOperation, ApiProduces, ApiTags } from '@nestjs/swagger';
import type { Request } from 'express';
import { AppError } from '../../common/errors/app-error.js';
import { ApiDataResponse, ApiErrorResponses } from '../../common/http/api-response.decorators.js';
import { FileUpload } from '../../common/http/file-upload.decorator.js';
import type { Paginated } from '../../common/http/envelope.js';
import { ParseObjectIdPipe } from '../../common/validation/parse-object-id.pipe.js';
import { CurrentActor, type AuditActor } from '../audit/audit.service.js';
import { RequirePermission } from '../auth/auth.decorators.js';
import type { Principal } from '../auth/auth.types.js';
import { StockMovementsService } from '../inventory/stock-movements.service.js';
import { XLSX_MIME } from '../spreadsheets/xlsx.js';
import type { UploadedFileInput } from '../storage/file-processing.service.js';
import { ImportJobDto, ImportStartedDto } from './dto/product-import.dto.js';
import { ProductImportService } from './product-import.service.js';
import { ProductSpreadsheetsService } from './product-spreadsheets.service.js';
import type { AdminProductSort } from './admin-products.repository.js';
import { AdminProductsService } from './admin-products.service.js';
import {
  AdminProductDto,
  AdminProductListItemDto,
  AdminProductListQueryDto,
  CreateProductDto,
  ProductStatusDto,
  StockAdjustmentDto,
  StockMovementDto,
  StockMovementListQueryDto,
  UpdateProductDto,
  VariantCreateInput,
  VariantUpdateInput,
} from './dto/admin-products.dto.js';

const productId = () => new ParseObjectIdPipe("We couldn't find that product.");
const variantId = () => new ParseObjectIdPipe("We couldn't find that variant.");

const SORT_FIELDS = ['updatedAt', 'createdAt', 'name', 'minPrice', 'totalStock'] as const;

function parseSort(sort: string | undefined): AdminProductSort {
  const [field = 'updatedAt', direction = 'desc'] = (sort ?? 'updatedAt:desc').split(':');
  const known = SORT_FIELDS.find((item) => item === field);
  if (known && (direction === 'asc' || direction === 'desc')) return { field: known, direction };
  throw AppError.validation('Sort by updatedAt, createdAt, name, minPrice or totalStock (asc or desc).');
}

function principalOf(req: Request): Principal {
  if (!req.principal) throw AppError.unauthenticated();
  return req.principal;
}

/**
 * SPEC §7.3 "Products and stock". Field-level permissions (`products.edit_price`,
 * `products.edit_stock`) are checked in the service against what actually changes.
 */
@ApiTags('Admin · Products')
@Controller('admin')
export class AdminProductsController {
  constructor(
    private readonly products: AdminProductsService,
    private readonly movements: StockMovementsService,
    private readonly imports: ProductImportService,
    private readonly spreadsheets: ProductSpreadsheetsService,
  ) {}

  @Get('products')
  @RequirePermission('products.view')
  @ApiOperation({ summary: 'Products (archived ones only with status=archived or all)' })
  @ApiDataResponse(AdminProductListItemDto, { paginated: true })
  @ApiErrorResponses(400, 401, 403)
  list(@Query() query: AdminProductListQueryDto): Promise<Paginated<AdminProductListItemDTO>> {
    return this.products.list(
      { q: query.q, categoryId: query.categoryId, brandId: query.brandId, status: query.status, lowStock: query.lowStock },
      query.page,
      query.pageSize,
      parseSort(query.sort),
    );
  }

  // The fixed paths below come before 'products/:id', so they aren't read as product ids.
  @Get('products/export')
  @RequirePermission('products.export')
  @ApiOperation({ summary: 'The filtered products as an Excel file, one row per variant (the import template columns)' })
  @ApiProduces(XLSX_MIME)
  @ApiErrorResponses(400, 401, 403)
  export(@Query() query: AdminProductListQueryDto): Promise<StreamableFile> {
    return this.spreadsheets.export({ q: query.q, categoryId: query.categoryId, brandId: query.brandId, status: query.status, lowStock: query.lowStock });
  }

  @Get('products/import-template')
  @RequirePermission('products.import')
  @ApiOperation({ summary: 'The Excel template for importing products' })
  @ApiProduces(XLSX_MIME)
  @ApiErrorResponses(401, 403)
  importTemplate(): StreamableFile {
    return this.spreadsheets.template();
  }

  @Post('products/import')
  @HttpCode(201)
  @RequirePermission('products.import')
  @FileUpload(IMPORT_UPLOAD_MAX_BYTES)
  @ApiOperation({ summary: 'Import products from the filled-in template (.xlsx up to 5 MB); runs in the background' })
  @ApiDataResponse(ImportStartedDto, { status: 201 })
  @ApiErrorResponses(400, 401, 403, 413, 415)
  async import(@Req() req: Request, @UploadedFile() file: UploadedFileInput | undefined): Promise<{ jobId: string }> {
    return { jobId: await this.imports.start(principalOf(req).userId, file) };
  }

  @Get('import-jobs/:id')
  @RequirePermission('products.import')
  @ApiOperation({ summary: 'Progress and results of a product import' })
  @ApiDataResponse(ImportJobDto)
  @ApiErrorResponses(401, 403, 404)
  importJob(@Param('id', new ParseObjectIdPipe("We couldn't find that import.")) id: string): Promise<ImportJobDTO> {
    return this.imports.status(id);
  }

  @Get('products/:id')
  @RequirePermission('products.view')
  @ApiOperation({ summary: 'One product with all variants, stock and prices' })
  @ApiDataResponse(AdminProductDto)
  @ApiErrorResponses(401, 403, 404)
  detail(@Param('id', productId()) id: string): Promise<AdminProductDTO> {
    return this.products.detail(id);
  }

  @Post('products')
  @RequirePermission('products.create')
  @ApiOperation({ summary: 'Create a product with its variants (initial stock needs products.edit_stock)' })
  @ApiDataResponse(AdminProductDto, { status: 201 })
  @ApiErrorResponses(400, 401, 403, 409)
  create(@Req() req: Request, @CurrentActor() actor: AuditActor, @Body() body: CreateProductDto): Promise<AdminProductDTO> {
    return this.products.create(principalOf(req), actor, body);
  }

  @Patch('products/:id')
  @RequirePermission('products.edit')
  @ApiOperation({ summary: 'Edit details and variants (price changes need products.edit_price; stock is not accepted)' })
  @ApiDataResponse(AdminProductDto)
  @ApiErrorResponses(400, 401, 403, 404, 409)
  update(
    @Req() req: Request,
    @CurrentActor() actor: AuditActor,
    @Param('id', productId()) id: string,
    @Body() body: UpdateProductDto,
  ): Promise<AdminProductDTO> {
    return this.products.update(principalOf(req), actor, id, body);
  }

  @Post('products/:id/variants')
  @RequirePermission('products.edit', 'products.edit_price')
  @ApiOperation({ summary: 'Add a variant' })
  @ApiDataResponse(AdminProductDto, { status: 201 })
  @ApiErrorResponses(400, 401, 403, 404, 409)
  addVariant(
    @Req() req: Request,
    @CurrentActor() actor: AuditActor,
    @Param('id', productId()) id: string,
    @Body() body: VariantCreateInput,
  ): Promise<AdminProductDTO> {
    return this.products.addVariant(principalOf(req), actor, id, body);
  }

  @Patch('products/:id/variants/:variantId')
  @RequirePermission('products.edit')
  @ApiOperation({ summary: 'Edit a variant (price fields need products.edit_price)' })
  @ApiDataResponse(AdminProductDto)
  @ApiErrorResponses(400, 401, 403, 404, 409)
  updateVariant(
    @Req() req: Request,
    @CurrentActor() actor: AuditActor,
    @Param('id', productId()) id: string,
    @Param('variantId', variantId()) variant: string,
    @Body() body: VariantUpdateInput,
  ): Promise<AdminProductDTO> {
    return this.products.updateVariant(principalOf(req), actor, id, variant, body);
  }

  @Post('products/:id/stock-adjustments')
  @RequirePermission('products.edit_stock')
  @HttpCode(200)
  @ApiOperation({ summary: 'Adjust a variant’s stock with a reason (the only manual way to change stock)' })
  @ApiDataResponse(AdminProductDto)
  @ApiErrorResponses(400, 401, 403, 404)
  adjustStock(
    @CurrentActor() actor: AuditActor,
    @Param('id', productId()) id: string,
    @Body() body: StockAdjustmentDto,
  ): Promise<AdminProductDTO> {
    return this.products.adjustStock(actor, id, body.variantId, body.change, body.reason);
  }

  @Post('products/:id/status')
  @RequirePermission('products.archive')
  @HttpCode(200)
  @ApiOperation({ summary: 'Show, hide or archive a product' })
  @ApiDataResponse(AdminProductDto)
  @ApiErrorResponses(400, 401, 403, 404, 409)
  setStatus(@CurrentActor() actor: AuditActor, @Param('id', productId()) id: string, @Body() body: ProductStatusDto): Promise<AdminProductDTO> {
    return this.products.setStatus(actor, id, body.status);
  }

  @Get('stock-movements')
  @RequirePermission('stock_movements.view')
  @ApiOperation({ summary: 'Stock history, newest first' })
  @ApiDataResponse(StockMovementDto, { paginated: true })
  @ApiErrorResponses(400, 401, 403)
  stockMovements(@Query() query: StockMovementListQueryDto): Promise<Paginated<StockMovementDTO>> {
    return this.movements.list(
      { sku: query.sku, productId: query.productId, reason: query.reason, from: query.from, to: query.to },
      query.page,
      query.pageSize,
    );
  }
}
