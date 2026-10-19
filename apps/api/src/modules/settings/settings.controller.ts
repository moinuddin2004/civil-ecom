import type { PageDTO, PublicSettingsDTO } from '@aricon/shared';
import { Controller, Get, Param } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { ApiDataResponse, ApiErrorResponses } from '../../common/http/api-response.decorators.js';
import { ParseSlugPipe } from '../../common/validation/parse-slug.pipe.js';
import { Public } from '../auth/auth.decorators.js';
import { PageDto, PublicSettingsDto } from './dto/settings.response.dto.js';
import { SettingsService } from './settings.service.js';

@ApiTags('Store')
@Public()
@Controller()
export class SettingsController {
  constructor(private readonly settings: SettingsService) {}

  @Get('settings/public')
  @ApiOperation({ summary: 'Store contact details, payment methods, COD limit and bank accounts' })
  @ApiDataResponse(PublicSettingsDto)
  publicSettings(): Promise<PublicSettingsDTO> {
    return this.settings.publicSettings();
  }

  @Get('pages/:key')
  @ApiOperation({ summary: 'Content page: about, faq, contact, refund-policy, delivery-policy, privacy-policy, terms' })
  @ApiDataResponse(PageDto)
  @ApiErrorResponses(404)
  page(@Param('key', new ParseSlugPipe("We couldn't find that page.")) key: string): Promise<PageDTO> {
    return this.settings.page(key);
  }
}
