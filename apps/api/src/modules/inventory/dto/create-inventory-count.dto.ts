import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { ArrayUnique, IsArray, IsIn, IsOptional, IsString, IsUUID, MaxLength, ValidateIf } from 'class-validator';
import { INVENTORY_COUNT_SCOPES, type InventoryCountScope } from '@hub/shared';
import { trimToNull } from '@/common/utils/transforms';

export class CreateInventoryCountDto {
  @ApiProperty({ enum: INVENTORY_COUNT_SCOPES })
  @IsIn(INVENTORY_COUNT_SCOPES, { message: 'Escopo invalido' })
  scope!: InventoryCountScope;

  @ApiPropertyOptional({ format: 'uuid' })
  @IsOptional()
  @Transform(trimToNull)
  @ValidateIf((_object, value) => value !== null)
  @IsUUID('4', { message: 'Categoria invalida' })
  categoryId?: string | null;

  @ApiPropertyOptional({ type: [String] })
  @IsOptional()
  @IsArray()
  @ArrayUnique()
  @IsUUID('4', { each: true, message: 'Produto invalido' })
  productIds?: string[];

  @ApiPropertyOptional()
  @IsOptional()
  @Transform(trimToNull)
  @ValidateIf((_object, value) => value !== null)
  @IsString()
  @MaxLength(500)
  notes?: string | null;
}
