import { Controller, Get } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import type { DashboardMetricsDto } from '@hub/shared';
import { CurrentUser } from '@/common/decorators/current-user.decorator';
import type { AuthenticatedUser } from '@/common/types/authenticated-user';
import { DashboardService } from './dashboard.service';

/**
 * Visao geral da operacao.
 *
 * Leitura para qualquer perfil autenticado: sao os numeros da propria loja, e
 * esconde-los de quem trabalha nela nao protege nada. O escopo vem sempre da
 * sessao - nenhum parametro de organizacao e aceito.
 */
@ApiTags('dashboard')
@Controller('dashboard')
export class DashboardController {
  constructor(private readonly dashboardService: DashboardService) {}

  @Get('metrics')
  @ApiOperation({
    summary: 'Metricas consolidadas da operacao',
    description:
      'KPIs de catalogo e estoque, serie mensal do ledger, comparativo com o mes anterior, cobertura por categoria e alertas.',
  })
  metrics(@CurrentUser() user: AuthenticatedUser): Promise<DashboardMetricsDto> {
    return this.dashboardService.metrics(user.organizationId);
  }
}
