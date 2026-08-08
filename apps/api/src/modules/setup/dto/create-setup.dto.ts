import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform, Type } from 'class-transformer';
import {
  ArrayUnique,
  IsArray,
  IsEmail,
  IsIn,
  IsObject,
  IsOptional,
  IsString,
  Length,
  Matches,
  MaxLength,
  MinLength,
  ValidateIf,
  ValidateNested,
} from 'class-validator';
import {
  BUSINESS_SEGMENTS,
  OPERATION_GOALS,
  type BusinessSegment,
  type OperationGoal,
} from '@hub/shared';
import { normalizeEmail, trimString, trimToNull } from '@/common/utils/transforms';

const optionalText = () => ValidateIf((_object, value) => value !== null);

export class SetupOwnerDto {
  @ApiProperty({ example: 'Maria Silva' })
  @Transform(trimString)
  @IsString()
  @MinLength(2, { message: 'Informe seu nome' })
  @MaxLength(160)
  name!: string;

  @ApiProperty({ example: 'maria@empresa.com.br' })
  @Transform(normalizeEmail)
  @IsEmail({}, { message: 'Informe um e-mail valido' })
  @MaxLength(180)
  email!: string;

  /**
   * Senha do unico usuario com acesso total a instalacao. Exigimos um minimo
   * real aqui porque nao ha administrador acima dele para recuperar a conta.
   */
  @ApiProperty({ minLength: 10 })
  @IsString()
  @MinLength(10, { message: 'A senha deve ter ao menos 10 caracteres' })
  @MaxLength(128)
  @Matches(/[a-zA-Z]/, { message: 'A senha deve conter ao menos uma letra' })
  @Matches(/\d/, { message: 'A senha deve conter ao menos um numero' })
  password!: string;
}

export class SetupAddressDto {
  @ApiPropertyOptional({ example: '01310-100' })
  @IsOptional()
  @Transform(trimToNull)
  @optionalText()
  @IsString()
  @MaxLength(16)
  zipCode?: string | null;

  @ApiPropertyOptional()
  @IsOptional()
  @Transform(trimToNull)
  @optionalText()
  @IsString()
  @MaxLength(180)
  street?: string | null;

  @ApiPropertyOptional()
  @IsOptional()
  @Transform(trimToNull)
  @optionalText()
  @IsString()
  @MaxLength(20)
  number?: string | null;

  @ApiPropertyOptional()
  @IsOptional()
  @Transform(trimToNull)
  @optionalText()
  @IsString()
  @MaxLength(120)
  complement?: string | null;

  @ApiPropertyOptional()
  @IsOptional()
  @Transform(trimToNull)
  @optionalText()
  @IsString()
  @MaxLength(120)
  district?: string | null;

  @ApiPropertyOptional()
  @IsOptional()
  @Transform(trimToNull)
  @optionalText()
  @IsString()
  @MaxLength(120)
  city?: string | null;

  @ApiPropertyOptional({ example: 'SP' })
  @IsOptional()
  @Transform(({ value }) => {
    const input: unknown = value;
    return typeof input === 'string' ? input.trim().toUpperCase() || null : input;
  })
  @optionalText()
  @IsString()
  @Length(2, 2, { message: 'UF deve ter duas letras' })
  state?: string | null;

  @ApiPropertyOptional({ example: 'Proximo ao mercado central' })
  @IsOptional()
  @Transform(trimToNull)
  @optionalText()
  @IsString()
  @MaxLength(200)
  reference?: string | null;
}

export class SetupCompanyDto {
  @ApiProperty({ example: 'Comercial Silva LTDA' })
  @Transform(trimString)
  @IsString()
  @MinLength(2, { message: 'Informe o nome da empresa' })
  @MaxLength(160)
  name!: string;

  @ApiPropertyOptional({ example: 'Casa Silva' })
  @IsOptional()
  @Transform(trimToNull)
  @optionalText()
  @IsString()
  @MaxLength(160)
  tradeName?: string | null;

  @ApiPropertyOptional({ example: '12.345.678/0001-99' })
  @IsOptional()
  @Transform(trimToNull)
  @optionalText()
  @IsString()
  @MaxLength(32)
  document?: string | null;

  @ApiPropertyOptional()
  @IsOptional()
  @Transform(trimToNull)
  @optionalText()
  @IsEmail({}, { message: 'Informe um e-mail valido para a empresa' })
  @MaxLength(180)
  email?: string | null;

  @ApiPropertyOptional({ example: '(11) 99999-0000' })
  @IsOptional()
  @Transform(trimToNull)
  @optionalText()
  @IsString()
  @MaxLength(32)
  phone?: string | null;

  /** Validacao de tamanho e mime acontece no service, sobre o data URL. */
  @ApiPropertyOptional({ description: 'Logo em data URL' })
  @IsOptional()
  @Transform(trimToNull)
  @optionalText()
  @IsString()
  logo?: string | null;

  @ApiPropertyOptional({ enum: BUSINESS_SEGMENTS, isArray: true })
  @IsOptional()
  @IsArray()
  @ArrayUnique()
  @IsIn(BUSINESS_SEGMENTS, { each: true, message: 'Segmento invalido' })
  segments?: BusinessSegment[];

  @ApiPropertyOptional({ enum: OPERATION_GOALS, isArray: true })
  @IsOptional()
  @IsArray()
  @ArrayUnique()
  @IsIn(OPERATION_GOALS, { each: true, message: 'Objetivo de operacao invalido' })
  operationGoals?: OperationGoal[];

  @ApiPropertyOptional({ type: SetupAddressDto })
  @IsOptional()
  @IsObject()
  @ValidateNested()
  @Type(() => SetupAddressDto)
  address?: SetupAddressDto;
}

export class CreateSetupDto {
  @ApiProperty({ type: SetupOwnerDto })
  @IsObject()
  @ValidateNested()
  @Type(() => SetupOwnerDto)
  owner!: SetupOwnerDto;

  @ApiProperty({ type: SetupCompanyDto })
  @IsObject()
  @ValidateNested()
  @Type(() => SetupCompanyDto)
  company!: SetupCompanyDto;
}
