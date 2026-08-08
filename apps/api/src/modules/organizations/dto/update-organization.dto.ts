import { ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import {
  ArrayUnique,
  IsArray,
  IsEmail,
  IsIn,
  IsOptional,
  IsString,
  MaxLength,
  MinLength,
  ValidateIf,
} from 'class-validator';
import { OPERATION_GOALS, type OperationGoal } from '@hub/shared';
import { trimString, trimToNull } from '@/common/utils/transforms';

const optionalText = () => ValidateIf((_object, value) => value !== null);

export class UpdateOrganizationDto {
  @ApiPropertyOptional({ example: 'Moveis Silva LTDA' })
  @IsOptional()
  @Transform(trimString)
  @IsString()
  @MinLength(2, { message: 'O nome da empresa deve ter ao menos 2 caracteres' })
  @MaxLength(160)
  name?: string;

  @ApiPropertyOptional({ example: 'Moveis Silva' })
  @IsOptional()
  @Transform(trimToNull)
  @optionalText()
  @IsString()
  @MaxLength(160)
  tradeName?: string | null;

  @ApiPropertyOptional({ example: '12345678000199' })
  @IsOptional()
  @Transform(trimToNull)
  @optionalText()
  @IsString()
  @MaxLength(32)
  document?: string | null;

  @ApiPropertyOptional({ example: 'contato@moveissilva.com.br' })
  @IsOptional()
  @Transform(trimToNull)
  @optionalText()
  @IsEmail({}, { message: 'Informe um e-mail valido' })
  @MaxLength(180)
  email?: string | null;

  @ApiPropertyOptional({ example: '(11) 99999-0000' })
  @IsOptional()
  @Transform(trimToNull)
  @optionalText()
  @IsString()
  @MaxLength(32)
  phone?: string | null;

  @ApiPropertyOptional({ enum: OPERATION_GOALS, isArray: true })
  @IsOptional()
  @IsArray()
  @ArrayUnique()
  @IsIn(OPERATION_GOALS, { each: true, message: 'Objetivo de operacao invalido' })
  operationGoals?: OperationGoal[];
}
