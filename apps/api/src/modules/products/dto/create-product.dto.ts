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
 */
export class CreateProductDto {
  @ApiProperty({ example: 'Sofa 3 lugares' })
  @Transform(trimString)
  @IsString()
  @MinLength(2, { message: 'O nome do produto deve ter ao menos 2 caracteres' })
  @MaxLength(200)
  name!: string;

  @ApiProperty({ example: 1299.9, minimum: 0 })
  @Transform(toOptionalNumber)
  @IsNumber({ maxDecimalPlaces: 2 }, { message: 'Informe um preco de venda valido' })
  @Min(0, { message: 'O preco de venda nao pode ser negativo' })
  salePrice!: number;

  @ApiPropertyOptional({ example: 'SOF-001' })
  @IsOptional()
  @Transform(trimToNull)
  @ValidateIf((_object, value) => value !== null)
  @IsString()
  @MaxLength(64)
  sku?: string | null;

  @ApiPropertyOptional({ example: '7891234567890' })
  @IsOptional()
  @Transform(trimToNull)
  @ValidateIf((_object, value) => value !== null)
  @IsString()
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

  @ApiPropertyOptional({ example: 780.5, minimum: 0 })
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

  @ApiPropertyOptional({ example: 10, minimum: 0, description: 'Estoque inicial' })
  @IsOptional()
  @Transform(toOptionalNumber)
  @IsNumber({ maxDecimalPlaces: 3 }, { message: 'Informe uma quantidade valida' })
  @Min(0, { message: 'A quantidade nao pode ser negativa' })
  stockQuantity?: number;

  @ApiPropertyOptional({ example: 2, minimum: 0, description: 'Estoque minimo para alerta' })
  @IsOptional()
  @Transform(toNullableNumber)
  @ValidateIf((_object, value) => value !== null)
  @IsNumber({ maxDecimalPlaces: 3 }, { message: 'Informe um estoque minimo valido' })
  @Min(0, { message: 'O estoque minimo nao pode ser negativo' })
  minStockQuantity?: number | null;

  @ApiPropertyOptional({ default: true })
  @IsOptional()
  @IsBoolean()
  active?: boolean;
}
