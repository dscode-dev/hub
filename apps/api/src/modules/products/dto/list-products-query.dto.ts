import { ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsBoolean, IsIn, IsOptional, IsString, IsUUID, MaxLength } from 'class-validator';
import { PaginationQueryDto } from '@/common/dto/pagination-query.dto';
import { STOCK_STATUSES, type StockStatus } from '@hub/shared';
import { toBooleanFromQuery, trimString } from '@/common/utils/transforms';

export const PRODUCT_SORT_FIELDS = ['name', 'salePrice', 'createdAt'] as const;
export type ProductSortField = (typeof PRODUCT_SORT_FIELDS)[number];

export class ListProductsQueryDto extends PaginationQueryDto {
  @ApiPropertyOptional({ description: 'Busca por nome, SKU ou codigo de barras' })
  @IsOptional()
  @Transform(trimString)
  @IsString()
  @MaxLength(200)
  search?: string;

  @ApiPropertyOptional({ format: 'uuid' })
  @IsOptional()
  @IsUUID('4', { message: 'Categoria invalida' })
  categoryId?: string;

  @ApiPropertyOptional({ description: 'Ausente retorna apenas produtos ativos' })
  @IsOptional()
  @Transform(toBooleanFromQuery)
  @IsBoolean()
  active?: boolean;

  @ApiPropertyOptional({ enum: STOCK_STATUSES, description: 'Filtra pelo status derivado' })
  @IsOptional()
  @IsIn(STOCK_STATUSES, { message: 'Status de estoque invalido' })
  stockStatus?: StockStatus;

  @ApiPropertyOptional({ enum: PRODUCT_SORT_FIELDS, default: 'createdAt' })
  @IsOptional()
  @IsIn(PRODUCT_SORT_FIELDS)
  sortBy: ProductSortField = 'createdAt';

  @ApiPropertyOptional({ enum: ['asc', 'desc'], default: 'desc' })
  @IsOptional()
  @IsIn(['asc', 'desc'])
  sortOrder: 'asc' | 'desc' = 'desc';
}
