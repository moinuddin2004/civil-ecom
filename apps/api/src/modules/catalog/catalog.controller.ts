import type { BrandDTO, CategoryNode, CategoryPageDTO, HomeDTO, SearchSuggestDTO } from '@aricon/shared';
import { Controller, Get, Param, Query } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { ApiDataResponse, ApiErrorResponses } from '../../common/http/api-response.decorators.js';
import { ParseSlugPipe } from '../../common/validation/parse-slug.pipe.js';
import { Public } from '../auth/auth.decorators.js';
import { CatalogService } from './catalog.service.js';
import { SuggestQueryDto } from './dto/catalog.query.dto.js';
import { BrandDto, CategoryNodeDto, CategoryPageDto, HomeDto, SearchSuggestDto } from './dto/catalog.response.dto.js';

/** Public store navigation (SPEC §7.2). Only active categories, brands and products. */
@ApiTags('Catalog')
@Public()
@Controller()
export class CatalogController {
  constructor(private readonly catalog: CatalogService) {}

  @Get('home')
  @ApiOperation({ summary: 'Homepage: banners, category tiles, featured, deals, new arrivals, brands' })
  @ApiDataResponse(HomeDto)
  home(): Promise<HomeDTO> {
    return this.catalog.home();
  }

  @Get('categories')
  @ApiOperation({ summary: 'Category tree with active-product counts' })
  @ApiDataResponse(CategoryNodeDto, { isArray: true })
  categories(): Promise<CategoryNode[]> {
    return this.catalog.categoryTree();
  }

  @Get('categories/:slug')
  @ApiOperation({ summary: 'One category with its sub-categories and breadcrumbs' })
  @ApiDataResponse(CategoryPageDto)
  @ApiErrorResponses(404)
  category(@Param('slug', new ParseSlugPipe("We couldn't find that category.")) slug: string): Promise<CategoryPageDTO> {
    return this.catalog.categoryPage(slug);
  }

  @Get('brands')
  @ApiOperation({ summary: 'Active brands' })
  @ApiDataResponse(BrandDto, { isArray: true })
  brands(): Promise<BrandDTO[]> {
    return this.catalog.brandList();
  }

  @Get('search/suggest')
  @ApiOperation({ summary: 'Search-as-you-type: up to 6 products, 3 categories, 3 brands' })
  @ApiDataResponse(SearchSuggestDto)
  @ApiErrorResponses(400)
  suggest(@Query() query: SuggestQueryDto): Promise<SearchSuggestDTO> {
    return this.catalog.suggest(query.q);
  }
}
