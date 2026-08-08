import { Body, Controller, Get, HttpCode, HttpStatus, Post } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import type { SetupResultDto, SetupStatusDto } from '@hub/shared';
import { Public } from '@/common/decorators/public.decorator';
import { CreateSetupDto } from './dto/create-setup.dto';
import { SetupService } from './setup.service';

/**
 * Rotas do primeiro acesso.
 *
 * Publicas por necessidade: sao executadas antes de existir qualquer usuario.
 * A protecao nao vem de autenticacao, e sim do fato de o cadastro so ser
 * aceito enquanto a instalacao nao tiver um OWNER.
 */
@ApiTags('setup')
@Controller('setup')
export class SetupController {
  constructor(private readonly setupService: SetupService) {}

  @Public()
  @Get('status')
  @ApiOperation({ summary: 'Informa se esta instalacao ainda precisa do primeiro acesso' })
  getStatus(): Promise<SetupStatusDto> {
    return this.setupService.getStatus();
  }

  @Public()
  @Post()
  @HttpCode(HttpStatus.CREATED)
  // Rota publica de escrita: limite estreito para nao virar alvo de tentativa.
  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  @ApiOperation({
    summary: 'Cria a empresa e o usuario responsavel',
    description:
      'Aceita apenas enquanto nao existir nenhum usuario OWNER. Depois disso responde 409.',
  })
  run(@Body() dto: CreateSetupDto): Promise<SetupResultDto> {
    return this.setupService.run(dto);
  }
}
