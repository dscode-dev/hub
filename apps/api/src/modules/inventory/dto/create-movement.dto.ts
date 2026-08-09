import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsIn, IsNumber, IsOptional, IsString, IsUUID, MaxLength, Min, ValidateIf } from 'class-validator';
import { MANUAL_INVENTORY_MOVEMENT_TYPES, type InventoryMovementType } from '@hub/shared';
import { toNullableNumber, toOptionalNumber, trimToNull } from '@/common/utils/transforms';

/**
 * Movimentacao manual.
 *
 * `quantity` vem SEMPRE positiva, em unidades humanas: o sinal e determinado
 * pelo tipo no servidor. Deixar o cliente enviar negativo permitiria lancar
 * uma "entrada" que na verdade reduz o saldo.
 */
export class CreateMovementDto {
  @ApiProperty({ format: 'uuid' })
  @IsUUID('4', { message: 'Produto invalido' })
  productId!: string;

  @ApiProperty({ enum: MANUAL_INVENTORY_MOVEMENT_TYPES })
  @IsIn(MANUAL_INVENTORY_MOVEMENT_TYPES, { message: 'Tipo de movimentacao invalido' })
  type!: InventoryMovementType;

  @ApiProperty({ example: 5, minimum: 0.001 })
  @Transform(toOptionalNumber)
  @IsNumber({ maxDecimalPlaces: 3 }, { message: 'Informe uma quantidade valida' })
  @Min(0.001, { message: 'A quantidade deve ser maior que zero' })
  quantity!: number;

  @ApiPropertyOptional({ example: 18.5 })
  @IsOptional()
  @Transform(toNullableNumber)
  @ValidateIf((_object, value) => value !== null)
  @IsNumber({ maxDecimalPlaces: 2 }, { message: 'Informe um custo unitario valido' })
  @Min(0)
  unitCost?: number | null;

  @ApiPropertyOptional({ example: 'Correcao de estoque' })
  @IsOptional()
  @Transform(trimToNull)
  @ValidateIf((_object, value) => value !== null)
  @IsString()
  @MaxLength(200)
  reason?: string | null;

  @ApiPropertyOptional()
  @IsOptional()
  @Transform(trimToNull)
  @ValidateIf((_object, value) => value !== null)
  @IsString()
  @MaxLength(500)
  notes?: string | null;
}
