import { ERROR_CODES, type ErrorCode } from '@aricon/shared';
import { applyDecorators, type Type } from '@nestjs/common';
import { ApiExtraModels, ApiProperty, ApiPropertyOptional, ApiResponse, getSchemaPath } from '@nestjs/swagger';
import { PageMetaDto } from './pagination.dto.js';

/* Swagger documentation for the envelope the interceptor adds (it is invisible to Swagger otherwise). */

export class ErrorBodyDto {
  @ApiProperty({ enum: ERROR_CODES, example: 'VALIDATION_ERROR' })
  code!: ErrorCode;

  @ApiProperty({ example: 'Some fields are missing or invalid.' })
  message!: string;

  @ApiPropertyOptional({
    description: 'For VALIDATION_ERROR: one entry per invalid field.',
    example: [{ path: 'email', message: 'Enter a valid email address.' }],
  })
  details?: unknown;
}

export class ErrorResponseDto {
  @ApiProperty({ type: ErrorBodyDto })
  error!: ErrorBodyDto;
}

export interface ApiDataOptions {
  status?: number;
  description?: string;
  /** `data` is an array of `model`. */
  isArray?: boolean;
  /** `{ data: model[], meta }`. */
  paginated?: boolean;
  /** Extra top-level siblings of a paginated list (`Paginated.extra`), e.g. `{ facets: ProductFacetsDto }`. */
  extra?: Record<string, Type<unknown>>;
}

/** Documents `{ data: model }`, `{ data: model[] }` or `{ data: model[], meta, ...extra }`. */
export function ApiDataResponse(model: Type<unknown>, options: ApiDataOptions = {}) {
  const item = { $ref: getSchemaPath(model) };
  const data = options.isArray || options.paginated ? { type: 'array', items: item } : item;
  const extra = Object.entries(options.extra ?? {});
  const properties: Record<string, object> = options.paginated
    ? { data, meta: { $ref: getSchemaPath(PageMetaDto) } }
    : { data };
  for (const [name, type] of extra) properties[name] = { $ref: getSchemaPath(type) };

  return applyDecorators(
    ApiExtraModels(model, PageMetaDto, ...extra.map(([, type]) => type)),
    ApiResponse({
      status: options.status ?? 200,
      description: options.description,
      schema: {
        type: 'object',
        required: Object.keys(properties),
        properties,
      },
    }),
  );
}

/** Documents the error envelope for the given statuses. */
export function ApiErrorResponses(...statuses: number[]) {
  return applyDecorators(
    ApiExtraModels(ErrorResponseDto),
    ...statuses.map((status) => ApiResponse({ status, type: ErrorResponseDto })),
  );
}
