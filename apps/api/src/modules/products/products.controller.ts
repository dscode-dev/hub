import { Body, Controller, Delete, Get, Param, ParseUUIDPipe, Patch, Post, Query } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import type { Paginated, ProductDto } from '@hub/shared';
import { CurrentUser } from '@/common/decorators/current-user.decorator';
import { Roles } from '@/common/decorators/roles.decorator';
import type { AuthenticatedUser } from '@/common/types/authenticated-user';
import { CreateProductDto } from './dto/create-product.dto';
import { ListProductsQueryDto } from './dto/list-products-query.dto';
import { UpdateProductDto } from './dto/update-product.dto';
import { ProductsService } from './products.service';

@ApiTags('products')
@Controller('products')
export class ProductsController {
  constructor(private readonly productsService: ProductsService) {}

  @Get()
  @ApiOperation({ summary: 'Lista produtos com busca por nome, SKU ou codigo de barras' })
  list(
    @CurrentUser() user: AuthenticatedUser,
    @Query() query: ListProductsQueryDto,
  ): Promise<Paginated<ProductDto>> {
    return this.productsService.list(user.organizationId, query);
  }

  @Post()
  @Roles('OWNER', 'ADMIN', 'MANAGER', 'STOCK')
  @ApiOperation({ summary: 'Cadastro rapido de produto' })
  create(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: CreateProductDto,
  ): Promise<ProductDto> {
    return this.productsService.create(user, dto);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Detalhe de um produto da organizacao' })
  findOne(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<ProductDto> {
    return this.productsService.findOne(user.organizationId, id);
  }

  @Patch(':id')
  @Roles('OWNER', 'ADMIN', 'MANAGER', 'STOCK')
  @ApiOperation({ summary: 'Atualiza um produto' })
  update(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateProductDto,
  ): Promise<ProductDto> {
    return this.productsService.update(user, id, dto);
  }

  @Delete(':id')
  @Roles('OWNER', 'ADMIN', 'MANAGER')
  @ApiOperation({
    summary: 'Remove um produto da operacao',
    description: 'Executa soft delete (active=false); o historico e preservado.',
  })
  remove(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<ProductDto> {
    return this.productsService.deactivate(user, id);
  }
}
