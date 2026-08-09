import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsObject, IsOptional, IsString, MaxLength, ValidateNested } from 'class-validator';

/**
 * Mapeamento coluna do arquivo -> campo do sistema.
 * Cada valor e o NOME da coluna no CSV escolhido pelo usuario.
 */
export class ImportFieldMappingDto {
  @ApiPropertyOptional({ description: 'Coluna do arquivo que contem o nome do produto' })
  @IsOptional()
  @IsString()
  @MaxLength(200)
  name?: string | null;

  @ApiPropertyOptional({ description: 'Coluna com o preco de venda' })
  @IsOptional()
  @IsString()
  @MaxLength(200)
  salePrice?: string | null;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(200)
  sku?: string | null;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(200)
  categoryName?: string | null;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(200)
  stockQuantity?: string | null;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(200)
  costPrice?: string | null;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(200)
  barcode?: string | null;

  @ApiPropertyOptional({ description: 'Coluna com o codigo da unidade (UN, KG...)' })
  @IsOptional()
  @IsString()
  @MaxLength(200)
  unitCode?: string | null;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(200)
  minimumStock?: string | null;
}

export class ApplyImportMappingDto {
  @ApiPropertyOptional({ type: ImportFieldMappingDto })
  @IsObject()
  @ValidateNested()
  @Type(() => ImportFieldMappingDto)
  mapping!: ImportFieldMappingDto;
}
