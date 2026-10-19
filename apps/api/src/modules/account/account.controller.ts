import type { AddressDTO, CustomerDTO } from '@aricon/shared';
import { Body, Controller, Delete, Get, HttpCode, Param, Patch, Post } from '@nestjs/common';
import { ApiCookieAuth, ApiNoContentResponse, ApiOperation, ApiTags } from '@nestjs/swagger';
import { minutes, Throttle } from '@nestjs/throttler';
import { ApiDataResponse, ApiErrorResponses } from '../../common/http/api-response.decorators.js';
import { ParseObjectIdPipe } from '../../common/validation/parse-object-id.pipe.js';
import { CurrentUser, CustomerOnly } from '../auth/auth.decorators.js';
import type { Principal } from '../auth/auth.types.js';
import { ChangePasswordDto } from '../auth/dto/auth.request.dto.js';
import { CustomerResponseDto } from '../auth/dto/auth.response.dto.js';
import { AccountService } from './account.service.js';
import { AddressDto, AddressResponseDto, UpdateProfileDto } from './dto/account.dto.js';

const addressId = () => new ParseObjectIdPipe("We couldn't find that address.");

/**
 * The signed-in customer's account (SPEC §7.2 "Account"). Address changes answer with the whole
 * updated list, since adding or deleting one can move the default.
 */
@ApiTags('Account')
@ApiCookieAuth('customer')
@CustomerOnly()
@Controller('account')
export class AccountController {
  constructor(private readonly account: AccountService) {}

  @Patch('profile')
  @ApiOperation({ summary: 'Update name, mobile number and company' })
  @ApiDataResponse(CustomerResponseDto)
  @ApiErrorResponses(400, 401, 409)
  updateProfile(@CurrentUser() user: Principal, @Body() body: UpdateProfileDto): Promise<CustomerDTO> {
    return this.account.updateProfile(user.userId, body);
  }

  @Post('change-password')
  @HttpCode(204)
  // The current password is checked without lockout counting, so limit guesses here.
  @Throttle({ default: { limit: 10, ttl: minutes(15) } })
  @ApiOperation({ summary: 'Change password; signs out every other device' })
  @ApiNoContentResponse()
  @ApiErrorResponses(400, 401, 429)
  async changePassword(@CurrentUser() user: Principal, @Body() body: ChangePasswordDto): Promise<void> {
    await this.account.changePassword(user, body);
  }

  @Get('addresses')
  @ApiOperation({ summary: 'Saved addresses' })
  @ApiDataResponse(AddressResponseDto, { isArray: true })
  @ApiErrorResponses(401)
  addresses(@CurrentUser() user: Principal): Promise<AddressDTO[]> {
    return this.account.addresses(user.userId);
  }

  @Post('addresses')
  @ApiOperation({ summary: 'Add an address (max 10); the first one becomes the default' })
  @ApiDataResponse(AddressResponseDto, { status: 201, isArray: true })
  @ApiErrorResponses(400, 401, 409)
  addAddress(@CurrentUser() user: Principal, @Body() body: AddressDto): Promise<AddressDTO[]> {
    return this.account.addAddress(user.userId, body);
  }

  @Patch('addresses/:id')
  @ApiOperation({ summary: 'Replace an address' })
  @ApiDataResponse(AddressResponseDto, { isArray: true })
  @ApiErrorResponses(400, 401, 404, 409)
  updateAddress(
    @CurrentUser() user: Principal,
    @Param('id', addressId()) id: string,
    @Body() body: AddressDto,
  ): Promise<AddressDTO[]> {
    return this.account.updateAddress(user.userId, id, body);
  }

  @Delete('addresses/:id')
  @ApiOperation({ summary: 'Delete an address; the next one becomes the default if needed' })
  @ApiDataResponse(AddressResponseDto, { isArray: true })
  @ApiErrorResponses(401, 404, 409)
  removeAddress(@CurrentUser() user: Principal, @Param('id', addressId()) id: string): Promise<AddressDTO[]> {
    return this.account.removeAddress(user.userId, id);
  }

  @Post('addresses/:id/default')
  @HttpCode(200)
  @ApiOperation({ summary: 'Make an address the default' })
  @ApiDataResponse(AddressResponseDto, { isArray: true })
  @ApiErrorResponses(401, 404, 409)
  setDefault(@CurrentUser() user: Principal, @Param('id', addressId()) id: string): Promise<AddressDTO[]> {
    return this.account.setDefaultAddress(user.userId, id);
  }
}
