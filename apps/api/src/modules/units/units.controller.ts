import { Controller, Get } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import type { UnitOfMeasureDto } from '@hub/shared';
import { CurrentUser } from '@/common/decorators/current-user.decorator';
import { PrismaService } from '@/common/prisma/prisma.service';
import type { AuthenticatedUser } from '@/common/types/authenticated-user';

/**
 * Unidades de medida disponiveis para o tenant.
 *
 * Devolve as padrao do sistema (organizationId nulo) somadas as proprias da
 * organizacao. Somente leitura nesta etapa: as padrao vem por migration.
 */
@ApiTags('units')
@Controller('units')
export class UnitsController {
  constructor(private readonly prisma: PrismaService) {}

  @Get()
  @ApiOperation({ summary: 'Lista unidades do sistema e da organizacao' })
  async list(@CurrentUser() user: AuthenticatedUser): Promise<{ data: UnitOfMeasureDto[] }> {
    const units = await this.prisma.unitOfMeasure.findMany({
      where: { active: true, OR: [{ organizationId: null }, { organizationId: user.organizationId }] },
      orderBy: [{ organizationId: 'asc' }, { code: 'asc' }],
      select: { id: true, code: true, name: true, symbol: true, allowsFraction: true },
    });

    return { data: units };
  }
}
