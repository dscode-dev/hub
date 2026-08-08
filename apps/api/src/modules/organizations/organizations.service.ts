import { Injectable } from '@nestjs/common';
import type { OrganizationDto } from '@hub/shared';
import { PrismaService } from '@/common/prisma/prisma.service';
import type { AuthenticatedUser } from '@/common/types/authenticated-user';
import { AuditService } from '@/modules/audit/audit.service';
import type { CompleteOnboardingDto } from './dto/complete-onboarding.dto';
import type { UpdateOrganizationDto } from './dto/update-organization.dto';
import { toOrganizationDto } from './organization.mapper';

/** Progresso de ativacao usado pela checklist da dashboard. */
export interface SetupStatus {
  productsCount: number;
  categoriesCount: number;
  steps: {
    key: 'first_product' | 'first_customer' | 'first_sale' | 'payment_methods';
    done: boolean;
    /** false enquanto o modulo correspondente ainda nao existe. */
    available: boolean;
  }[];
}

@Injectable()
export class OrganizationsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditService: AuditService,
  ) {}

  async findMine(organizationId: string): Promise<OrganizationDto> {
    const organization = await this.prisma.organization.findUniqueOrThrow({
      where: { id: organizationId },
    });

    return toOrganizationDto(organization);
  }

  async updateMine(user: AuthenticatedUser, dto: UpdateOrganizationDto): Promise<OrganizationDto> {
    const organization = await this.prisma.organization.update({
      where: { id: user.organizationId },
      data: {
        name: dto.name,
        tradeName: dto.tradeName,
        document: dto.document,
        email: dto.email,
        phone: dto.phone,
        operationGoals: dto.operationGoals,
      },
    });

    await this.auditService.record({
      organizationId: user.organizationId,
      userId: user.id,
      action: 'ORGANIZATION_UPDATED',
      entity: 'Organization',
      entityId: organization.id,
      metadata: { fields: Object.keys(dto) },
    });

    return toOrganizationDto(organization);
  }

  async completeOnboarding(
    user: AuthenticatedUser,
    dto: CompleteOnboardingDto,
  ): Promise<OrganizationDto> {
    const organization = await this.prisma.organization.update({
      where: { id: user.organizationId },
      data: {
        name: dto.name,
        tradeName: dto.tradeName ?? null,
        phone: dto.phone ?? null,
        operationGoals: dto.operationGoals ?? [],
        onboardingCompletedAt: new Date(),
      },
    });

    await this.auditService.record({
      organizationId: user.organizationId,
      userId: user.id,
      action: 'ONBOARDING_COMPLETED',
      entity: 'Organization',
      entityId: organization.id,
      metadata: { operationGoals: dto.operationGoals ?? [] },
    });

    return toOrganizationDto(organization);
  }

  async getSetupStatus(organizationId: string): Promise<SetupStatus> {
    const [productsCount, categoriesCount] = await Promise.all([
      this.prisma.product.count({ where: { organizationId, active: true } }),
      this.prisma.category.count({ where: { organizationId, active: true } }),
    ]);

    return {
      productsCount,
      categoriesCount,
      steps: [
        { key: 'first_product', done: productsCount > 0, available: true },
        // Modulos ainda nao implementados: aparecem na checklist como "em breve".
        { key: 'first_customer', done: false, available: false },
        { key: 'first_sale', done: false, available: false },
        { key: 'payment_methods', done: false, available: false },
      ],
    };
  }
}
