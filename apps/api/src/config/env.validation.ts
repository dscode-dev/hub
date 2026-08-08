import { plainToInstance } from 'class-transformer';
import { IsBoolean, IsInt, IsOptional, IsString, MinLength, validateSync } from 'class-validator';
import { Transform } from 'class-transformer';

/**
 * Validacao das variaveis de ambiente na inicializacao.
 * Falhar cedo e mais barato do que descobrir um segredo ausente em producao.
 */
export class EnvironmentVariables {
  @IsString()
  @IsOptional()
  NODE_ENV: string = 'development';

  @IsInt()
  @Transform(({ value }) => Number(value ?? 5010))
  PORT: number = 5010;

  @IsString()
  DATABASE_URL!: string;

  @IsString()
  @MinLength(32, { message: 'JWT_ACCESS_SECRET deve ter ao menos 32 caracteres' })
  JWT_ACCESS_SECRET!: string;

  @IsInt()
  @Transform(({ value }) => Number(value ?? 900))
  JWT_ACCESS_EXPIRES_IN: number = 900;

  @IsInt()
  @Transform(({ value }) => Number(value ?? 2592000))
  REFRESH_TOKEN_EXPIRES_IN: number = 2592000;

  @IsString()
  @IsOptional()
  CORS_ORIGINS?: string;

  @IsBoolean()
  @Transform(({ value }) => value === undefined || value === 'true' || value === true)
  SWAGGER_ENABLED: boolean = true;
}

export function validateEnv(config: Record<string, unknown>): EnvironmentVariables {
  const validated = plainToInstance(EnvironmentVariables, config, {
    enableImplicitConversion: false,
    exposeDefaultValues: true,
  });

  const errors = validateSync(validated, { skipMissingProperties: false });

  if (errors.length > 0) {
    const details = errors
      .map((error) => Object.values(error.constraints ?? {}).join(', '))
      .join('\n  - ');
    throw new Error(`Configuracao de ambiente invalida:\n  - ${details}`);
  }

  return validated;
}
