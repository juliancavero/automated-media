import { Module } from '@nestjs/common';
import { GoogleAIUploadService } from './google-ai-upload.service';

@Module({
  providers: [GoogleAIUploadService],
  exports: [GoogleAIUploadService],
})
export class GoogleAIUploadModule {}
