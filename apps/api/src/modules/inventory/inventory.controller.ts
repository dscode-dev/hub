import { Body, Controller, Get, Param, ParseUUIDPipe, Post, Query } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import type {
  InventoryItemDto,
  InventoryMovementDto,
  InventorySummaryDto,
  Paginated,
} from '@hub/shared';
import { CurrentUser } from '@/common/decorators/current-user.decorator';
import { Roles } from '@/common/decorators/roles.decorator';
import type { AuthenticatedUser } from '@/common/types/authenticated-user';
import { CreateMovementDto } from './dto/create-movement.dto';
import { ListInventoryQueryDto } from './dto/list-inventory-query.dto';
import { ListMovementsQueryDto } from './dto/list-movements-query.dto';
import { InventoryService } from './inventory.service';

/**
 * Consulta e movimentacao de estoque.
 *
 * Politica de acesso: consultar e amplo (vendedor precisa saber se tem
 * estoque); MOVIMENTAR e restrito a quem responde pelo estoque. Nenhum
 * endpoint aceita organizationId do cliente - sempre da sessao.
 */
@ApiTags('inventory')
@Controller('inventory')
export class InventoryController {
  constructor(private readonly inventoryService: InventoryService) {}

  @Get()
  @ApiOperation({ summary: 'Lista os produtos com controle de estoque' })
  list(
    @CurrentUser() user: AuthenticatedUser,
    @Query() query: ListInventoryQueryDto,
  ): Promise<Paginated<InventoryItemDto>> {
    return this.inventoryService.list(user.organizationId, query);
  }

  @Get('summary')
  @ApiOperation({ summary: 'Resumo do estoque (controlados, baixo, sem estoque)' })
  summary(@CurrentUser() user: AuthenticatedUser): Promise<InventorySummaryDto> {
    return this.inventoryService.summary(user.organizationId);
  }

  @Get('movements')
  @ApiOperation({ summary: 'Extrato de movimentacoes, com filtros' })
  listMovements(
    @CurrentUser() user: AuthenticatedUser,
    @Query() query: ListMovementsQueryDto,
  ): Promise<Paginated<InventoryMovementDto>> {
    return this.inventoryService.listMovements(user.organizationId, query);
  }

  @Get('products/:productId')
  @ApiOperation({ summary: 'Situacao de estoque de um produto' })
  getProduct(
    @CurrentUser() user: AuthenticatedUser,
    @Param('productId', ParseUUIDPipe) productId: string,
  ): Promise<InventoryItemDto> {
    return this.inventoryService.getProductInventory(user.organizationId, productId);
  }

  @Get('products/:productId/movements')
  @ApiOperation({ summary: 'Historico de movimentacoes de um produto' })
  listProductMovements(
    @CurrentUser() user: AuthenticatedUser,
    @Param('productId', ParseUUIDPipe) productId: string,
    @Query() query: ListMovementsQueryDto,
  ): Promise<Paginated<InventoryMovementDto>> {
    // Muta o DTO em vez de espalhar: `skip` e getter da classe e se perderia
    // num objeto literal.
    query.productId = productId;

    return this.inventoryService.listMovements(user.organizationId, query);
  }

  @Post('movements')
  // Quem mexe no estoque responde por ele: vendedor e financeiro nao ajustam.
  @Roles('OWNER', 'ADMIN', 'MANAGER', 'STOCK')
  @ApiOperation({
    summary: 'Registra uma movimentacao manual',
    description:
      'A quantidade e sempre positiva; o sinal vem do tipo. Movimentos sao imutaveis: correcoes exigem um novo movimento compensatorio.',
  })
  createMovement(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: CreateMovementDto,
  ): Promise<InventoryMovementDto> {
    return this.inventoryService.createMovement(user, dto);
  }
}
