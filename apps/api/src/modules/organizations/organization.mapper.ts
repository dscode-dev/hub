import type { Organization } from '@prisma/client';
import type { OrganizationDto } from '@hub/shared';

export function toOrganizationDto(organization: Organization): OrganizationDto {
  return {
    id: organization.id,
    name: organization.name,
    tradeName: organization.tradeName,
    document: organization.document,
    email: organization.email,
    phone: organization.phone,
    operationGoals: organization.operationGoals,
    onboardingCompletedAt: organization.onboardingCompletedAt?.toISOString() ?? null,
    createdAt: organization.createdAt.toISOString(),
    updatedAt: organization.updatedAt.toISOString(),
  };
}
