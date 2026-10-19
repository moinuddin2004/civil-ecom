import type { AdminBrandDTO, AdminCategoryDTO } from '@aricon/shared';
import { Body, Controller, Get, Param, Patch, Post } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { ApiDataResponse, ApiErrorResponses } from '../../../common/http/api-response.decorators.js';
import { ParseObjectIdPipe } from '../../../common/validation/parse-object-id.pipe.js';
import { CurrentActor, type AuditActor } from '../../audit/audit.service.js';
import { RequireAnyPermission, RequirePermission } from '../../auth/auth.decorators.js';
import { AdminCatalogService } from './admin-catalog.service.js';
import {
  AdminBrandDto,
  AdminCategoryDto,
  CreateBrandDto,
  CreateCategoryDto,
  UpdateBrandDto,
  UpdateCategoryDto,
} from './dto/admin-catalog.dto.js';

const categoryId = () => new ParseObjectIdPipe("We couldn't find that category.");
const brandId = () => new ParseObjectIdPipe("We couldn't find that brand.");

/** SPEC §7.3 "Catalog": categories and brands (short lists, not paginated). */
@ApiTags('Admin · Catalog')
@Controller('admin')
export class AdminCatalogController {
  constructor(private readonly catalog: AdminCatalogService) {}

  @Get('categories')
  @RequireAnyPermission('products.view', 'categories.manage')
  @ApiOperation({ summary: 'All categories, hidden ones included, with active-product counts' })
  @ApiDataResponse(AdminCategoryDto, { isArray: true })
  @ApiErrorResponses(401, 403)
  categories(): Promise<AdminCategoryDTO[]> {
    return this.catalog.listCategories();
  }

  @Post('categories')
  @RequirePermission('categories.manage')
  @ApiOperation({ summary: 'Add a category (two levels at most)' })
  @ApiDataResponse(AdminCategoryDto, { status: 201 })
  @ApiErrorResponses(400, 401, 403, 409)
  createCategory(@CurrentActor() actor: AuditActor, @Body() body: CreateCategoryDto): Promise<AdminCategoryDTO> {
    return this.catalog.createCategory(actor, body);
  }

  @Patch('categories/:id')
  @RequirePermission('categories.manage')
  @ApiOperation({ summary: 'Edit, move or hide a category (hiding needs no active products: 409 with a count)' })
  @ApiDataResponse(AdminCategoryDto)
  @ApiErrorResponses(400, 401, 403, 404, 409)
  updateCategory(
    @CurrentActor() actor: AuditActor,
    @Param('id', categoryId()) id: string,
    @Body() body: UpdateCategoryDto,
  ): Promise<AdminCategoryDTO> {
    return this.catalog.updateCategory(actor, id, body);
  }

  @Get('brands')
  @RequireAnyPermission('products.view', 'brands.manage')
  @ApiOperation({ summary: 'All brands, hidden ones included, with active-product counts' })
  @ApiDataResponse(AdminBrandDto, { isArray: true })
  @ApiErrorResponses(401, 403)
  brands(): Promise<AdminBrandDTO[]> {
    return this.catalog.listBrands();
  }

  @Post('brands')
  @RequirePermission('brands.manage')
  @ApiOperation({ summary: 'Add a brand' })
  @ApiDataResponse(AdminBrandDto, { status: 201 })
  @ApiErrorResponses(400, 401, 403, 409)
  createBrand(@CurrentActor() actor: AuditActor, @Body() body: CreateBrandDto): Promise<AdminBrandDTO> {
    return this.catalog.createBrand(actor, body);
  }

  @Patch('brands/:id')
  @RequirePermission('brands.manage')
  @ApiOperation({ summary: 'Edit or hide a brand (a rename updates its products)' })
  @ApiDataResponse(AdminBrandDto)
  @ApiErrorResponses(400, 401, 403, 404, 409)
  updateBrand(@CurrentActor() actor: AuditActor, @Param('id', brandId()) id: string, @Body() body: UpdateBrandDto): Promise<AdminBrandDTO> {
    return this.catalog.updateBrand(actor, id, body);
  }
}
