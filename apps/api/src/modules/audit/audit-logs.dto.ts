import { AUDIT_ACTIONS, AUDIT_ENTITIES, ROLES, type AuditAction, type AuditEntity, type AuditLogDTO, type Role } from '@aricon/shared';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsIn, IsOptional, IsString, MaxLength } from 'class-validator';
import { PaginationQueryDto } from '../../common/http/pagination.dto.js';
import { IsObjectId, IsOptionalDateKey } from '../../common/validation/validators.js';


export class AuditLogQueryDto extends PaginationQueryDto {
  @ApiPropertyOptional() @IsOptional() @IsObjectId() actorId?: string;
  @ApiPropertyOptional({ enum: AUDIT_ENTITIES }) @IsOptional() @IsIn(AUDIT_ENTITIES) entity?: AuditEntity;
  @ApiPropertyOptional({ description: 'An id, or "settings" / "home".' })
  @IsOptional()
  @IsString()
  @MaxLength(60)
  entityId?: string;
  @ApiPropertyOptional({ enum: AUDIT_ACTIONS }) @IsOptional() @IsIn(AUDIT_ACTIONS) action?: AuditAction;
  @ApiPropertyOptional({ example: '2026-09-01' }) @IsOptionalDateKey() from?: string;
  @ApiPropertyOptional({ example: '2026-09-30' }) @IsOptionalDateKey() to?: string;
}

export class AuditLogDto implements AuditLogDTO {
  @ApiProperty() id!: string;
  @ApiProperty({ format: 'date-time' }) at!: string;
  @ApiProperty() actorId!: string;
  @ApiProperty() actorName!: string;
  @ApiProperty({ enum: ROLES }) actorRole!: Role;
  @ApiProperty({ enum: AUDIT_ACTIONS }) action!: AuditAction;
  @ApiProperty({ enum: AUDIT_ENTITIES }) entity!: AuditEntity;
  @ApiProperty() entityId!: string;
  @ApiProperty({ type: Object, nullable: true, description: 'Changed fields before.' }) before!: Record<string, unknown> | null;
  @ApiProperty({ type: Object, nullable: true, description: 'Changed fields after.' }) after!: Record<string, unknown> | null;
  @ApiProperty({ type: String, nullable: true }) ip!: string | null;
}
