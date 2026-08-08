import { Module } from '@nestjs/common';
import { CategoriesModule } from '@/modules/categories/categories.module';
import { ProductImportController } from './import/product-import.controller';
import { ProductImportService } from './import/product-import.service';
import { ProductsController } from './products.controller';
import { ProductsService } from './products.service';

@Module({
  imports: [CategoriesModule],
  // A rota de importacao vem antes para nao ser capturada por /products/:id.
  controllers: [ProductImportController, ProductsController],
  providers: [ProductsService, ProductImportService],
  exports: [ProductsService],
})
export class ProductsModule {}
