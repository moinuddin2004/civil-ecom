import { Global, Module } from '@nestjs/common';
import { AuditLogsController } from './audit-logs.controller.js';
import { AuditLogsService } from './audit-logs.service.js';
import { AuditService } from './audit.service.js';

/** Global: every admin module records its writes here; ADMINs browse them. */
@Global()
@Module({
  controllers: [AuditLogsController],
  providers: [AuditService, AuditLogsService],
  exports: [AuditService],
})
export class AuditModule {}
