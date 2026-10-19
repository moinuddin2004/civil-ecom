import { DEFAULT_PAGE_SIZE, MAX_PAGE_SIZE, type PageMeta } from '@aricon/shared';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsInt, Max, Min } from 'class-validator';

/** `?page=1&pageSize=20` on every list endpoint; the page size never exceeds 100 (SPEC §7.1). */
export class PaginationQueryDto {
  @ApiPropertyOptional({ minimum: 1, default: 1 })
  @Type(() => Number)
  @IsInt({ message: 'Page must be a whole number.' })
  @Min(1, { message: 'Page starts at 1.' })
  @Max(100_000)
  page: number = 1;

  @ApiPropertyOptional({ minimum: 1, maximum: MAX_PAGE_SIZE, default: DEFAULT_PAGE_SIZE })
  @Type(() => Number)
  @IsInt({ message: 'Page size must be a whole number.' })
  @Min(1, { message: 'Page size must be at least 1.' })
  @Max(MAX_PAGE_SIZE, { message: `Page size can be at most ${MAX_PAGE_SIZE}.` })
  pageSize: number = DEFAULT_PAGE_SIZE;

  /** Documents to skip for this page. */
  get skip(): number {
    return (this.page - 1) * this.pageSize;
  }
}

export class PageMetaDto implements PageMeta {
  @ApiProperty({ example: 1 })
  page!: number;

  @ApiProperty({ example: 20 })
  pageSize!: number;

  @ApiProperty({ example: 356 })
  total!: number;
}
