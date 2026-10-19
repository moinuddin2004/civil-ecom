import { Global, Module } from '@nestjs/common';
import { RevalidationService } from './revalidation.service.js';

/** Global: catalog, homepage, settings and stock changes all refresh storefront pages. */
@Global()
@Module({
  providers: [RevalidationService],
  exports: [RevalidationService],
})
export class RevalidationModule {}
