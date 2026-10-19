import { Module } from '@nestjs/common';
import { AdminUploadsController } from './admin-uploads.controller.js';
import { UploadsService } from './uploads.service.js';

@Module({
  controllers: [AdminUploadsController],
  providers: [UploadsService],
})
export class UploadsModule {}
