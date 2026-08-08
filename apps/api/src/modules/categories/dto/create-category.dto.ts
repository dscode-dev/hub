import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsBoolean, IsOptional, IsString, MaxLength, MinLength, ValidateIf } from 'class-validator';
import { trimString, trimToNull } from '@/common/utils/transforms';

export class CreateCategoryDto {
  @ApiProperty({ example: 'Sofas' })
  @Transform(trimString)
  @IsString()
  @MinLength(2, { message: 'O nome da categoria deve ter ao menos 2 caracteres' })
  @MaxLength(120)
  name!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @Transform(trimToNull)
  @ValidateIf((_object, value) => value !== null)
  @IsString()
  @MaxLength(500)
  description?: string | null;

  @ApiPropertyOptional({ default: true })
  @IsOptional()
  @IsBoolean()
  active?: boolean;
}
