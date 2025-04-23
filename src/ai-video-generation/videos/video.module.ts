import { Module } from '@nestjs/common';
import { VideoService } from './services/video.service';
import { ImageModule } from '../images/image.module';
import { AudioModule } from '../audios/audio.module';
import { MongooseModule } from '@nestjs/mongoose';
import { Video, VideoSchema } from './entities/video.schema';
import { VideoGenerationService } from './services/video-generation.service';
import { CloudinaryModule } from 'src/external/cloudinary/cloudinary.module';
import { VideoController } from './controllers/video.controller';
import { VideoGenerationController } from './controllers/video-generation.controller';
import { AiModule } from 'src/external/ai/ai.module';
import { BullModule } from '@nestjs/bullmq';
import { VideoQueueService } from './queues/video-queue.service';

@Module({
  imports: [
    MongooseModule.forFeature([{ name: Video.name, schema: VideoSchema }]),
    BullModule.registerQueue({
      name: 'video-processing',
    }),
    VideoModule,
    ImageModule,
    AudioModule,
    CloudinaryModule,
    AiModule
  ],
  controllers: [VideoController, VideoGenerationController],
  providers: [VideoService, VideoGenerationService, VideoQueueService],
  exports: [VideoService, VideoGenerationService, VideoQueueService],
})
export class VideoModule { }
