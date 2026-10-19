import type { PricedCart } from '@aricon/shared';
import { Body, Controller, Delete, Get, HttpCode, Param, Post, Put, Query } from '@nestjs/common';
import { ApiCookieAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { ApiDataResponse, ApiErrorResponses } from '../../common/http/api-response.decorators.js';
import { ParseObjectIdPipe } from '../../common/validation/parse-object-id.pipe.js';
import { CurrentUser, CustomerOnly, Public } from '../auth/auth.decorators.js';
import type { Principal } from '../auth/auth.types.js';
import { CartService } from './cart.service.js';
import { CartAreaQueryDto, CartQuoteDto, MergeCartDto, SetCartItemDto } from './dto/cart.request.dto.js';
import { PricedCartDto } from './dto/cart.response.dto.js';

/**
 * Carts (SPEC §7.2 "Cart"). Guests price their `localStorage` cart with `quote`; customers have a
 * stored cart. Every response is the cart priced now; `?areaId=` adds the delivery estimate.
 */
@ApiTags('Cart')
@Controller('cart')
export class CartController {
  constructor(private readonly cart: CartService) {}

  @Post('quote')
  @Public()
  @HttpCode(200)
  @ApiOperation({ summary: "Price a guest's cart (no login needed)" })
  @ApiDataResponse(PricedCartDto)
  @ApiErrorResponses(400)
  quote(@Body() body: CartQuoteDto): Promise<PricedCart> {
    return this.cart.quote(body.items, body.areaId);
  }

  @Get()
  @CustomerOnly()
  @ApiCookieAuth('customer')
  @ApiOperation({ summary: "The customer's cart, priced" })
  @ApiDataResponse(PricedCartDto)
  @ApiErrorResponses(400, 401)
  get(@CurrentUser() user: Principal, @Query() query: CartAreaQueryDto): Promise<PricedCart> {
    return this.cart.get(user.userId, query.areaId);
  }

  @Put('items')
  @CustomerOnly()
  @ApiCookieAuth('customer')
  @ApiOperation({ summary: 'Set the quantity of a line (0 removes it)' })
  @ApiDataResponse(PricedCartDto)
  @ApiErrorResponses(400, 401, 404, 409)
  setItem(
    @CurrentUser() user: Principal,
    @Body() body: SetCartItemDto,
    @Query() query: CartAreaQueryDto,
  ): Promise<PricedCart> {
    return this.cart.setItem(user.userId, body.variantId, body.qty, query.areaId);
  }

  @Delete('items/:variantId')
  @CustomerOnly()
  @ApiCookieAuth('customer')
  @ApiOperation({ summary: 'Remove a line' })
  @ApiDataResponse(PricedCartDto)
  @ApiErrorResponses(401, 404)
  removeItem(
    @CurrentUser() user: Principal,
    @Param('variantId', new ParseObjectIdPipe()) variantId: string,
    @Query() query: CartAreaQueryDto,
  ): Promise<PricedCart> {
    return this.cart.removeItem(user.userId, variantId, query.areaId);
  }

  @Post('merge')
  @CustomerOnly()
  @HttpCode(200)
  @ApiCookieAuth('customer')
  @ApiOperation({ summary: 'Merge the guest cart after login (quantities added, capped at stock)' })
  @ApiDataResponse(PricedCartDto)
  @ApiErrorResponses(400, 401)
  merge(@CurrentUser() user: Principal, @Body() body: MergeCartDto, @Query() query: CartAreaQueryDto): Promise<PricedCart> {
    return this.cart.merge(user.userId, body.items, query.areaId);
  }
}
