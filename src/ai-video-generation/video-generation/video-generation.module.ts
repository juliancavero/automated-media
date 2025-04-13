import { Module } from '@nestjs/common';
import { VideoGenerationController } from './video-generation.controller';
import { VideoGenerationService } from './video-generation.service';
import { AudioModule } from '../audio/audio.module';
import { VideoModule } from '../video/video.module';
import {
  VideoGeneration,
  VideoGenerationSchema,
} from './entities/video-generation.entity';
import { MongooseModule } from '@nestjs/mongoose';
import { ImageGenerationModule } from '../image-generation/image-generation.module';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: VideoGeneration.name, schema: VideoGenerationSchema },
    ]),
    AudioModule,
    VideoModule,
    ImageGenerationModule,
    VideoGenerationModule,
  ],
  controllers: [VideoGenerationController],
  providers: [VideoGenerationService],
  exports: [VideoGenerationService],
})
export class VideoGenerationModule {}
