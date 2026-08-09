import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import {
  IsBoolean,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
  Min,
  MinLength,
  ValidateIf,
} from 'class-validator';
import {
  toNullableNumber,
  toOptionalNumber,
  trimString,
  trimToNull,
} from '@/common/utils/transforms';

/**
 * Cadastro rapido: apenas `name` e `salePrice` sao obrigatorios.
 * Todo o resto pode ser completado depois, sem bloquear o usuario.
 *
 * Quantidades chegam em unidades humanas (10, 1.5) e viram milesimos no
 * service. O cliente nunca precisa saber que existe `milli`.
 */
export class CreateProductDto {
  @ApiProperty({ example: 'Cafe Premium 500g' })
  @Transform(trimString)
  @IsString()
  @MinLength(2, { message: 'O nome do produto deve ter ao menos 2 caracteres' })
  @MaxLength(200)
  name!: string;

  @ApiProperty({ example: 29.9, minimum: 0 })
  @Transform(toOptionalNumber)
  @IsNumber({ maxDecimalPlaces: 2 }, { message: 'Informe um preco de venda valido' })
  @Min(0, { message: 'O preco de venda nao pode ser negativo' })
  salePrice!: number;

  @ApiPropertyOptional({ example: 'CAF001' })
  @IsOptional()
  @Transform(trimToNull)
  @ValidateIf((_object, value) => value !== null)
  @IsString()
  @MaxLength(64)
  sku?: string | null;

  @ApiPropertyOptional({ example: '7891234567890', description: 'EAN, UPC, Code128 ou interno' })
  @IsOptional()
  @Transform(trimToNull)
  @ValidateIf((_object, value) => value !== null)
  @IsString()
  // Amplo de proposito: nao restringimos a EAN-13.
  @MinLength(4, { message: 'Codigo de barras muito curto' })
  @MaxLength(64)
  barcode?: string | null;

  @ApiPropertyOptional()
  @IsOptional()
  @Transform(trimToNull)
  @ValidateIf((_object, value) => value !== null)
  @IsString()
  @MaxLength(2000)
  description?: string | null;

  @ApiPropertyOptional({ format: 'uuid' })
  @IsOptional()
  @Transform(trimToNull)
  @ValidateIf((_object, value) => value !== null)
  @IsUUID('4', { message: 'Categoria invalida' })
  categoryId?: string | null;

  @ApiPropertyOptional({ format: 'uuid', description: 'Unidade de medida' })
  @IsOptional()
  @Transform(trimToNull)
  @ValidateIf((_object, value) => value !== null)
  @IsUUID('4', { message: 'Unidade de medida invalida' })
  unitId?: string | null;

  @ApiPropertyOptional({ example: 18.5, minimum: 0 })
  @IsOptional()
  @Transform(toNullableNumber)
  @ValidateIf((_object, value) => value !== null)
  @IsNumber({ maxDecimalPlaces: 2 }, { message: 'Informe um preco de custo valido' })
  @Min(0, { message: 'O preco de custo nao pode ser negativo' })
  costPrice?: number | null;

  @ApiPropertyOptional({ default: false })
  @IsOptional()
  @IsBoolean()
  trackInventory?: boolean;

  /**
   * Estoque inicial. NAO e persistido como campo: vira um movimento
   * INITIAL_STOCK no ledger, que passa a ser a explicacao do saldo.
   */
  @ApiPropertyOptional({ example: 10, minimum: 0, description: 'Vira movimento INITIAL_STOCK' })
  @IsOptional()
  @Transform(toOptionalNumber)
  @IsNumber({ maxDecimalPlaces: 3 }, { message: 'Informe uma quantidade valida' })
  @Min(0, { message: 'A quantidade nao pode ser negativa' })
  initialQuantity?: number;

  @ApiPropertyOptional({ example: 5, minimum: 0, description: 'Nivel de alerta' })
  @IsOptional()
  @Transform(toNullableNumber)
  @ValidateIf((_object, value) => value !== null)
  @IsNumber({ maxDecimalPlaces: 3 }, { message: 'Informe um estoque minimo valido' })
  @Min(0, { message: 'O estoque minimo nao pode ser negativo' })
  minimumStock?: number | null;

  @ApiPropertyOptional({ default: true })
  @IsOptional()
  @IsBoolean()
  active?: boolean;
}
