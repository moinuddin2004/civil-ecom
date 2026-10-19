import { Global, Module } from '@nestjs/common';
import { DevFilesController } from './dev-files.controller.js';
import { FileProcessingService } from './file-processing.service.js';
import { StorageService } from './storage.service.js';

/** Global: uploads, receipts, invoices and imports all store files. */
@Global()
@Module({
  controllers: [DevFilesController],
  providers: [StorageService, FileProcessingService],
  exports: [StorageService, FileProcessingService],
})
export class StorageModule {}
