import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsIn, IsISO8601, IsOptional, IsUUID } from 'class-validator';
import { INVENTORY_MOVEMENT_TYPES, type InventoryMovementType } from '@hub/shared';
import { PaginationQueryDto } from '@/common/dto/pagination-query.dto';

export class ListMovementsQueryDto extends PaginationQueryDto {
  @ApiPropertyOptional({ format: 'uuid' })
  @IsOptional()
  @IsUUID('4', { message: 'Produto invalido' })
  productId?: string;

  @ApiPropertyOptional({ enum: INVENTORY_MOVEMENT_TYPES })
  @IsOptional()
  @IsIn(INVENTORY_MOVEMENT_TYPES, { message: 'Tipo de movimentacao invalido' })
  type?: InventoryMovementType;

  @ApiPropertyOptional({ description: 'Inicio do periodo (ISO 8601)' })
  @IsOptional()
  @IsISO8601({}, { message: 'Data inicial invalida' })
  from?: string;

  @ApiPropertyOptional({ description: 'Fim do periodo (ISO 8601)' })
  @IsOptional()
  @IsISO8601({}, { message: 'Data final invalida' })
  to?: string;
}
