import { Module } from '@nestjs/common';
import { UsersRepository } from './users.repository.js';

/** The `users` collection. Customer/staff management endpoints will live here too. */
@Module({
  providers: [UsersRepository],
  exports: [UsersRepository],
})
export class UsersModule {}
