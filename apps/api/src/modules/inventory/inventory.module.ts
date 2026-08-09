import { Module } from '@nestjs/common';
import { InventoryCountController } from './inventory-count.controller';
import { InventoryCountService } from './inventory-count.service';
import { InventoryLedgerService } from './inventory-ledger.service';
import { InventoryController } from './inventory.controller';
import { InventoryService } from './inventory.service';

@Module({
  // Contagens antes do controller generico: /inventory/counts nao pode ser
  // capturado por /inventory/:algo.
  controllers: [InventoryCountController, InventoryController],
  providers: [InventoryLedgerService, InventoryService, InventoryCountService],
  // Produtos e importacao registram movimentos pelo mesmo ledger.
  exports: [InventoryLedgerService],
})
export class InventoryModule {}
