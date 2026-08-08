import { Controller, Get, HttpStatus, Res } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import type { Response } from 'express';
import { Public } from './common/decorators/public.decorator';
import { PrismaService } from './common/prisma/prisma.service';

interface HealthResponse {
  status: 'ok' | 'degraded';
  database: 'ok' | 'down';
}

/**
 * Readiness da instalacao.
 *
 * O Electron so abre a janela quando esta rota responde 200 com o banco ok.
 * Por isso a resposta reflete o estado real: um backend de pe com o banco
 * inacessivel nao esta pronto para atender, e responder "ok" faria a UI abrir
 * para quebrar na primeira consulta.
 */
@ApiTags('health')
@Controller('health')
export class HealthController {
  constructor(private readonly prisma: PrismaService) {}

  @Public()
  @Get()
  @ApiOperation({ summary: 'Verifica a API e o banco local' })
  async check(@Res({ passthrough: true }) response: Response): Promise<HealthResponse> {
    const databaseUp = await this.prisma.isHealthy();

    // 503 enquanto o banco nao responde: readiness precisa ser verificavel
    // pelo status HTTP, nao apenas pelo corpo.
    response.status(databaseUp ? HttpStatus.OK : HttpStatus.SERVICE_UNAVAILABLE);

    return {
      status: databaseUp ? 'ok' : 'degraded',
      database: databaseUp ? 'ok' : 'down',
    };
  }
}
