import type { ProductCard, ProductDetail } from '@aricon/shared';
import { Controller, Get, Param, Query } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { ApiDataResponse, ApiErrorResponses } from '../../common/http/api-response.decorators.js';
import type { Paginated } from '../../common/http/envelope.js';
import { ParseSlugPipe } from '../../common/validation/parse-slug.pipe.js';
import { Public } from '../auth/auth.decorators.js';
import { ProductListQueryDto } from './dto/catalog.query.dto.js';
import { ProductCardDto, ProductDetailDto, ProductFacetsDto } from './dto/catalog.response.dto.js';
import { ProductsService } from './products.service.js';

const productSlug = () => new ParseSlugPipe("We couldn't find that product.");

@ApiTags('Catalog')
@Public()
@Controller('products')
export class ProductsController {
  constructor(private readonly products: ProductsService) {}

  @Get()
  @ApiOperation({
    summary: 'Product listing with filters, sorting and facets',
    description: 'Each facet counts the current results ignoring its own filter.',
  })
  @ApiDataResponse(ProductCardDto, { paginated: true, extra: { facets: ProductFacetsDto } })
  @ApiErrorResponses(400, 404)
  list(@Query() query: ProductListQueryDto): Promise<Paginated<ProductCard>> {
    return this.products.list(query);
  }

  @Get(':slug')
  @ApiOperation({ summary: 'One product with its active variants' })
  @ApiDataResponse(ProductDetailDto)
  @ApiErrorResponses(404)
  detail(@Param('slug', productSlug()) slug: string): Promise<ProductDetail> {
    return this.products.detail(slug);
  }

  @Get(':slug/related')
  @ApiOperation({ summary: 'Up to 8 related products' })
  @ApiDataResponse(ProductCardDto, { isArray: true })
  @ApiErrorResponses(404)
  related(@Param('slug', productSlug()) slug: string): Promise<ProductCard[]> {
    return this.products.related(slug);
  }
}
