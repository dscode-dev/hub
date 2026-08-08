import { Body, Controller, Get, Patch, Post } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import type { OrganizationDto } from '@hub/shared';
import { CurrentUser } from '@/common/decorators/current-user.decorator';
import { Roles } from '@/common/decorators/roles.decorator';
import type { AuthenticatedUser } from '@/common/types/authenticated-user';
import { CompleteOnboardingDto } from './dto/complete-onboarding.dto';
import { UpdateOrganizationDto } from './dto/update-organization.dto';
import { OrganizationsService, type SetupStatus } from './organizations.service';

/**
 * Sempre "me": a organizacao vem da sessao. Nao existe rota que aceite
 * organizationId vindo do cliente.
 */
@ApiTags('organizations')
@Controller('organizations')
export class OrganizationsController {
  constructor(private readonly organizationsService: OrganizationsService) {}

  @Get('me')
  @ApiOperation({ summary: 'Dados da organizacao da sessao atual' })
  findMine(@CurrentUser() user: AuthenticatedUser): Promise<OrganizationDto> {
    return this.organizationsService.findMine(user.organizationId);
  }

  @Patch('me')
  @Roles('OWNER', 'ADMIN')
  @ApiOperation({ summary: 'Atualiza dados da organizacao' })
  updateMine(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: UpdateOrganizationDto,
  ): Promise<OrganizationDto> {
    return this.organizationsService.updateMine(user, dto);
  }

  @Post('me/onboarding')
  @Roles('OWNER', 'ADMIN')
  @ApiOperation({ summary: 'Conclui o onboarding inicial da organizacao' })
  completeOnboarding(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: CompleteOnboardingDto,
  ): Promise<OrganizationDto> {
    return this.organizationsService.completeOnboarding(user, dto);
  }

  @Get('me/setup-status')
  @ApiOperation({ summary: 'Progresso da configuracao inicial (checklist da dashboard)' })
  getSetupStatus(@CurrentUser() user: AuthenticatedUser): Promise<SetupStatus> {
    return this.organizationsService.getSetupStatus(user.organizationId);
  }
}
