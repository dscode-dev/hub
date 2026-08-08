import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import type { CategoryDto, Paginated } from '@hub/shared';
import { paginate } from '@/common/dto/pagination-query.dto';
import { PrismaService } from '@/common/prisma/prisma.service';
import type { CreateCategoryDto } from './dto/create-category.dto';
import type { ListCategoriesQueryDto } from './dto/list-categories-query.dto';
import type { UpdateCategoryDto } from './dto/update-category.dto';

type CategoryWithCount = Prisma.CategoryGetPayload<{ include: { _count: { select: { products: true } } } }>;

function toCategoryDto(category: CategoryWithCount): CategoryDto {
  return {
    id: category.id,
    organizationId: category.organizationId,
    name: category.name,
    description: category.description,
    active: category.active,
    productCount: category._count.products,
    createdAt: category.createdAt.toISOString(),
    updatedAt: category.updatedAt.toISOString(),
  };
}

@Injectable()
export class CategoriesService {
  constructor(private readonly prisma: PrismaService) {}

  async list(organizationId: string, query: ListCategoriesQueryDto): Promise<Paginated<CategoryDto>> {
    const where: Prisma.CategoryWhereInput = {
      organizationId,
      active: query.active ?? true,
      ...(query.search
        ? { name: { contains: query.search, mode: Prisma.QueryMode.insensitive } }
        : {}),
    };

    const [categories, total] = await this.prisma.$transaction([
      this.prisma.category.findMany({
        where,
        include: { _count: { select: { products: true } } },
        orderBy: { name: 'asc' },
        skip: query.skip,
        take: query.pageSize,
      }),
      this.prisma.category.count({ where }),
    ]);

    return paginate(categories.map(toCategoryDto), total, query);
  }

  async create(organizationId: string, dto: CreateCategoryDto): Promise<CategoryDto> {
    await this.assertNameIsFree(organizationId, dto.name);

    const category = await this.prisma.category.create({
      data: {
        organizationId,
        name: dto.name,
        description: dto.description ?? null,
        active: dto.active ?? true,
      },
      include: { _count: { select: { products: true } } },
    });

    return toCategoryDto(category);
  }

  async update(
    organizationId: string,
    id: string,
    dto: UpdateCategoryDto,
  ): Promise<CategoryDto> {
    await this.getOwnedOrFail(organizationId, id);

    if (dto.name) {
      await this.assertNameIsFree(organizationId, dto.name, id);
    }

    const category = await this.prisma.category.update({
      where: { id },
      data: {
        name: dto.name,
        description: dto.description,
        active: dto.active,
      },
      include: { _count: { select: { products: true } } },
    });

    return toCategoryDto(category);
  }

  /** Soft delete: a categoria some das listas mas os produtos mantem o vinculo. */
  async deactivate(organizationId: string, id: string): Promise<CategoryDto> {
    await this.getOwnedOrFail(organizationId, id);

    const category = await this.prisma.category.update({
      where: { id },
      data: { active: false },
      include: { _count: { select: { products: true } } },
    });

    return toCategoryDto(category);
  }

  /**
   * Usado pela importacao: reaproveita a categoria existente (case-insensitive)
   * ou cria uma nova, evitando duplicar "Sofas" e "sofas".
   */
  async findOrCreateByName(organizationId: string, name: string): Promise<string> {
    const trimmed = name.trim();

    const existing = await this.prisma.category.findFirst({
      where: {
        organizationId,
        name: { equals: trimmed, mode: Prisma.QueryMode.insensitive },
      },
      select: { id: true },
    });

    if (existing) {
      return existing.id;
    }

    const created = await this.prisma.category.create({
      data: { organizationId, name: trimmed },
      select: { id: true },
    });

    return created.id;
  }

  /** Toda leitura por id passa por aqui: id + organizationId, nunca so o id. */
  private async getOwnedOrFail(organizationId: string, id: string) {
    const category = await this.prisma.category.findFirst({
      where: { id, organizationId },
      select: { id: true },
    });

    if (!category) {
      throw new NotFoundException('Categoria nao encontrada');
    }

    return category;
  }

  private async assertNameIsFree(organizationId: string, name: string, ignoreId?: string) {
    const duplicate = await this.prisma.category.findFirst({
      where: {
        organizationId,
        name: { equals: name, mode: Prisma.QueryMode.insensitive },
        ...(ignoreId ? { NOT: { id: ignoreId } } : {}),
      },
      select: { id: true },
    });

    if (duplicate) {
      throw new ConflictException('Ja existe uma categoria com esse nome');
    }
  }
}
