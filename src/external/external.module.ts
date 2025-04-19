import { Module } from '@nestjs/common';
import { CloudinaryModule } from './cloudinary/cloudinary.module';
import { AwsPollyModule } from './aws-polly/aws-polly.module';
import { HuggingFaceModule } from './huggingface/huggingface.module';
import { VyrioAiModule } from './vyrioai/vyrioai.module';

@Module({
  imports: [CloudinaryModule, AwsPollyModule, HuggingFaceModule, VyrioAiModule],
  providers: [],
  exports: [CloudinaryModule, AwsPollyModule, HuggingFaceModule, VyrioAiModule],
})
export class ExternalModule {}
