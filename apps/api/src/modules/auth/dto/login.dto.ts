import { ApiProperty } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsEmail, IsString, MaxLength, MinLength } from 'class-validator';
import { normalizeEmail } from '@/common/utils/transforms';

export class LoginDto {
  @ApiProperty({ example: 'owner@plataformahub.local' })
  @Transform(normalizeEmail)
  @IsEmail({}, { message: 'Informe um e-mail valido' })
  @MaxLength(180)
  email!: string;

  @ApiProperty({ example: 'Hub@123456', minLength: 8 })
  @IsString()
  @MinLength(8, { message: 'A senha deve ter ao menos 8 caracteres' })
  @MaxLength(128)
  password!: string;
}
