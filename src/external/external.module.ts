import { Module } from '@nestjs/common';
import { CloudinaryModule } from './cloudinary/cloudinary.module';
import { AwsPollyModule } from './aws-polly/aws-polly.module';
import { HuggingFaceModule } from './huggingface/huggingface.module';
import { VyrioAiModule } from './vyrioai/vyrioai.module';
import { AiModule } from './ai/ai.module';
import { GoogleAIUploadModule } from './google-ai-upload/google-ai-upload.module';

@Module({
  imports: [CloudinaryModule, AwsPollyModule, HuggingFaceModule, VyrioAiModule, AiModule, GoogleAIUploadModule],
  providers: [],
  exports: [CloudinaryModule, AwsPollyModule, HuggingFaceModule, VyrioAiModule, AiModule, GoogleAIUploadModule],
})
export class ExternalModule { }
