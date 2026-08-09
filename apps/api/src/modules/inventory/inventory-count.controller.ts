import { Body, Controller, Get, Param, ParseUUIDPipe, Patch, Post } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import type { InventoryCountDto } from '@hub/shared';
import { CurrentUser } from '@/common/decorators/current-user.decorator';
import { Roles } from '@/common/decorators/roles.decorator';
import type { AuthenticatedUser } from '@/common/types/authenticated-user';
import { CreateInventoryCountDto } from './dto/create-inventory-count.dto';
import { SaveCountItemsDto } from './dto/save-count-items.dto';
import { InventoryCountService } from './inventory-count.service';

/**
 * Inventario fisico.
 *
 * Concluir uma contagem gera ajustes reais de estoque, entao o modulo inteiro
 * exige o mesmo papel de quem pode movimentar.
 */
@ApiTags('inventory')
@Controller('inventory/counts')
@Roles('OWNER', 'ADMIN', 'MANAGER', 'STOCK')
export class InventoryCountController {
  constructor(private readonly countService: InventoryCountService) {}

  @Get()
  @ApiOperation({ summary: 'Lista os inventarios da organizacao' })
  list(@CurrentUser() user: AuthenticatedUser): Promise<InventoryCountDto[]> {
    return this.countService.list(user.organizationId);
  }

  @Post()
  @ApiOperation({
    summary: 'Abre um inventario',
    description:
      'Captura o saldo de cada produto como snapshot. A comparacao e o conflito na conclusao sao feitos contra esse valor.',
  })
  create(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: CreateInventoryCountDto,
  ): Promise<InventoryCountDto> {
    return this.countService.create(user, dto);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Detalhe do inventario, com itens' })
  findOne(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<InventoryCountDto> {
    return this.countService.findOne(user.organizationId, id);
  }

  @Patch(':id/items')
  @ApiOperation({ summary: 'Salva as quantidades contadas (nao altera o estoque)' })
  saveItems(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: SaveCountItemsDto,
  ): Promise<InventoryCountDto> {
    return this.countService.saveItems(user, id, dto);
  }

  @Post(':id/complete')
  @ApiOperation({
    summary: 'Conclui o inventario e gera os ajustes',
    description:
      'Responde 409 se o estoque de algum item mudou desde o snapshot - a contagem precisa ser revista antes.',
  })
  complete(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<InventoryCountDto> {
    return this.countService.complete(user, id);
  }

  @Post(':id/cancel')
  @ApiOperation({ summary: 'Cancela o inventario sem gerar ajustes' })
  cancel(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<InventoryCountDto> {
    return this.countService.cancel(user, id);
  }
}
