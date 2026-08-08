import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import {
  ArrayUnique,
  IsArray,
  IsIn,
  IsOptional,
  IsString,
  MaxLength,
  MinLength,
  ValidateIf,
} from 'class-validator';
import { OPERATION_GOALS, type OperationGoal } from '@hub/shared';
import { trimString, trimToNull } from '@/common/utils/transforms';

/**
 * Onboarding em uma unica chamada: o frontend acumula as etapas e envia no fim.
 * Se o usuario abandonar no meio, nada e persistido pela metade.
 */
export class CompleteOnboardingDto {
  @ApiProperty({ example: 'Moveis Silva LTDA' })
  @Transform(trimString)
  @IsString()
  @MinLength(2, { message: 'Informe o nome da empresa' })
  @MaxLength(160)
  name!: string;

  @ApiPropertyOptional({ example: 'Moveis Silva' })
  @IsOptional()
  @Transform(trimToNull)
  @ValidateIf((_object, value) => value !== null)
  @IsString()
  @MaxLength(160)
  tradeName?: string | null;

  @ApiPropertyOptional({ example: '(11) 99999-0000' })
  @IsOptional()
  @Transform(trimToNull)
  @ValidateIf((_object, value) => value !== null)
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
