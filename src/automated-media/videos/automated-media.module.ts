import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { AutomatedMediaService } from './automated-media.service';
import { AiModule } from '../ai/ai.module';
import { GoogleAIUploadService } from 'src/automated-media/google-ai-upload/google-ai-upload.service';
import { CloudinaryModule } from 'src/automated-media/cloudinary/cloudinary.module';
import { CloudinaryService } from 'src/automated-media/cloudinary/cloudinary.service';
import { AutomatedMediaController } from './automated-media.controller';
import {
  AutomatedMedia,
  AutomatedMediaSchema,
} from './schemas/automated-media.schema';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: AutomatedMedia.name, schema: AutomatedMediaSchema },
    ]),
    AiModule,
    CloudinaryModule,
  ],
  controllers: [AutomatedMediaController],
  providers: [AutomatedMediaService, GoogleAIUploadService, CloudinaryService],
  exports: [AutomatedMediaService],
})
export class AutomatedMediaModule {}
