import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';
import { VideoService } from './video.service';
import { VideoQueueService } from './video-queue.service';
import { CloudinaryModule } from 'src/automated-media/cloudinary/cloudinary.module';

@Module({
  imports: [
    BullModule.registerQueue({
      name: 'video-generation-queue',
    }),
    CloudinaryModule,
  ],
  controllers: [],
  providers: [VideoQueueService, VideoService],
  exports: [VideoQueueService, VideoService],
})
export class VideoModule {}
