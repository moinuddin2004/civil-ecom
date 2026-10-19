import { Module } from '@nestjs/common';
import { ProductStockRepository } from './product-stock.repository.js';
import { StockMovementsService } from './stock-movements.service.js';

/** Stock levels and stock movements (SPEC §5.12, §6.10): the only way stock changes. */
@Module({
  providers: [ProductStockRepository, StockMovementsService],
  exports: [ProductStockRepository, StockMovementsService],
})
export class InventoryModule {}
