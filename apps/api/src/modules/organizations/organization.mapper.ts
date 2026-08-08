import type { Organization } from '@prisma/client';
import type { BusinessSegment, OperationGoal, OrganizationDto } from '@hub/shared';
import { parseStringList } from '@/common/utils/string-list';

export function toOrganizationDto(organization: Organization): OrganizationDto {
  return {
    id: organization.id,
    name: organization.name,
    tradeName: organization.tradeName,
    document: organization.document,
    email: organization.email,
    phone: organization.phone,
    logo: organization.logo,
    segments: parseStringList<BusinessSegment>(organization.segments),
    address: {
      zipCode: organization.addressZipCode,
      street: organization.addressStreet,
      number: organization.addressNumber,
      complement: organization.addressComplement,
      district: organization.addressDistrict,
      city: organization.addressCity,
      state: organization.addressState,
      reference: organization.addressReference,
    },
    operationGoals: parseStringList<OperationGoal>(organization.operationGoals),
    onboardingCompletedAt: organization.onboardingCompletedAt?.toISOString() ?? null,
    createdAt: organization.createdAt.toISOString(),
    updatedAt: organization.updatedAt.toISOString(),
  };
}
