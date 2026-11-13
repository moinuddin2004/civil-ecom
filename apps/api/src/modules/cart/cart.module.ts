import { Module } from '@nestjs/common';
import { DeliveryModule } from '../delivery/delivery.module.js';
import { SettingsModule } from '../settings/settings.module.js';
import { CartPricingService } from './cart-pricing.service.js';
import { CartProductsRepository } from './cart-products.repository.js';
import { CartController } from './cart.controller.js';
import { CartService } from './cart.service.js';
import { CartsRepository } from './carts.repository.js';

@Module({
  imports: [SettingsModule, DeliveryModule],
  controllers: [CartController],
  providers: [CartsRepository, CartProductsRepository, CartPricingService, CartService],
  exports: [CartsRepository, CartProductsRepository, CartPricingService, CartService],
})
export class CartModule {}
