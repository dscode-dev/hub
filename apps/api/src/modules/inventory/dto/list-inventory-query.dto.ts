import { ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsIn, IsOptional, IsString, IsUUID, MaxLength } from 'class-validator';
import { STOCK_STATUSES, type StockStatus } from '@hub/shared';
import { PaginationQueryDto } from '@/common/dto/pagination-query.dto';
import { trimString } from '@/common/utils/transforms';

export class ListInventoryQueryDto extends PaginationQueryDto {
  @ApiPropertyOptional({ description: 'Busca por nome do produto' })
  @IsOptional()
  @Transform(trimString)
  @IsString()
  @MaxLength(200)
  search?: string;

  @ApiPropertyOptional({ format: 'uuid' })
  @IsOptional()
  @IsUUID('4', { message: 'Categoria invalida' })
  categoryId?: string;

  @ApiPropertyOptional({ enum: STOCK_STATUSES })
  @IsOptional()
  @IsIn(STOCK_STATUSES, { message: 'Status de estoque invalido' })
  status?: StockStatus;
}
