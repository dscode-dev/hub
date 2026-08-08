import { ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsBoolean, IsOptional, IsString, MaxLength } from 'class-validator';
import { PaginationQueryDto } from '@/common/dto/pagination-query.dto';
import { toBooleanFromQuery, trimString } from '@/common/utils/transforms';

export class ListCategoriesQueryDto extends PaginationQueryDto {
  @ApiPropertyOptional({ description: 'Busca por nome' })
  @IsOptional()
  @Transform(trimString)
  @IsString()
  @MaxLength(120)
  search?: string;

  @ApiPropertyOptional({ description: 'Filtra por status; ausente retorna apenas ativas' })
  @IsOptional()
  @Transform(toBooleanFromQuery)
  @IsBoolean()
  active?: boolean;
}
