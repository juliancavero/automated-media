import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { VideosService } from './videos.service';
import { VideosController } from './videos.controller';
import { VideoPreviewController } from './video-preview.controller';
import { Video, VideoSchema } from './schemas/video.schema';
import { AiModule } from '../ai/ai.module';
import { GoogleAIUploadService } from 'src/google-ai-upload/google-ai-upload.service';

@Module({
  imports: [
    MongooseModule.forFeature([{ name: Video.name, schema: VideoSchema }]),
    AiModule,
  ],
  controllers: [VideosController, VideoPreviewController],
  providers: [VideosService, GoogleAIUploadService],
  exports: [VideosService],
})
export class VideosModule {}
