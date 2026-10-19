import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module.js';
import { DeliveryModule } from '../delivery/delivery.module.js';
import { UsersModule } from '../users/users.module.js';
import { AccountController } from './account.controller.js';
import { AccountService } from './account.service.js';

@Module({
  imports: [UsersModule, AuthModule, DeliveryModule],
  controllers: [AccountController],
  providers: [AccountService],
})
export class AccountModule {}
