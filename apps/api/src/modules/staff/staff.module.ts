import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module.js';
import { UsersModule } from '../users/users.module.js';
import { StaffController } from './staff.controller.js';
import { StaffService } from './staff.service.js';

/** Staff accounts and the permission catalog (SPEC §4, §7.3). */
@Module({
  imports: [UsersModule, AuthModule],
  controllers: [StaffController],
  providers: [StaffService],
})
export class StaffModule {}
