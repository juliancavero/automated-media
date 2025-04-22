import { Module } from '@nestjs/common';
import { AiService } from './ai.service';
import { GoogleAIUploadModule } from '../google-ai-upload/google-ai-upload.module';

@Module({
  imports: [GoogleAIUploadModule],
  providers: [AiService],
  exports: [AiService],
})
export class AiModule { }
