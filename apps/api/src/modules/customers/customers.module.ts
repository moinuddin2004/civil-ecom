import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module.js';
import { DeliveryModule } from '../delivery/delivery.module.js';
import { UsersModule } from '../users/users.module.js';
import { CustomersController } from './customers.controller.js';
import { CustomersRepository } from './customers.repository.js';
import { CustomersService } from './customers.service.js';

/** The admin customer directory (SPEC §7.3 "Customers"). */
@Module({
  imports: [UsersModule, AuthModule, DeliveryModule],
  controllers: [CustomersController],
  providers: [CustomersRepository, CustomersService],
})
export class CustomersModule {}
