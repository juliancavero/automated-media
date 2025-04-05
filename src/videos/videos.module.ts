import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { VideosService } from './videos.service';
import { VideosController } from './videos.controller';
import { Video, VideoSchema } from './schemas/video.schema';
import { AiModule } from '../ai/ai.module';
import { GoogleAIUploadService } from 'src/google-ai-upload/google-ai-upload.service';
import { CloudinaryModule } from 'src/cloudinary/cloudinary.module';
import { CloudinaryService } from 'src/cloudinary/cloudinary.service';

@Module({
  imports: [
    MongooseModule.forFeature([{ name: Video.name, schema: VideoSchema }]),
    AiModule,
    CloudinaryModule,
  ],
  controllers: [VideosController],
  providers: [VideosService, GoogleAIUploadService, CloudinaryService],
  exports: [VideosService],
})
export class VideosModule {}
