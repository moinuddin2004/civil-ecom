import { Global, Module } from '@nestjs/common';
import { JobsService } from './jobs.service.js';

/** Global: email, imports and future jobs all queue work here (SPEC §13). */
@Global()
@Module({
  providers: [JobsService],
  exports: [JobsService],
})
export class JobsModule {}
