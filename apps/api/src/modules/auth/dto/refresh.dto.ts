import { ApiProperty } from '@nestjs/swagger';
import { IsString, MaxLength, MinLength } from 'class-validator';

export class RefreshDto {
  @ApiProperty({ description: 'Refresh token opaco emitido no login' })
  @IsString()
  @MinLength(32)
  @MaxLength(256)
  refreshToken!: string;
}
