import { BullModule } from '@nestjs/bullmq';
import { Module } from '@nestjs/common';
import { AudioQueueConsumer } from './consumers/audio-queue.consumer';
import { ImageQueueConsumer } from './consumers/image-queue.consumer';
import { AudioModule } from '../audio/audio.module';
import { ImageGenerationModule } from '../image-generation/image-generation.module';
import { QueueService } from './queue.service';
import { VideoGenerationModule } from '../video-generation/video-generation.module';
import { VideoQueueProcessor } from './consumers/video-queue.consumer';
import { AudioEventListener } from './listeners/audio-event.listener';
import { ImageEventListener } from './listeners/image-event.listener';
import { VideoModule } from '../video/video.module';

@Module({
  imports: [
    BullModule.forRoot({
      connection: {
        url: process.env.REDIS_URL,
      },
    }),
    BullModule.registerQueue(
      {
        name: 'image-generation',
      },
      {
        name: 'audio-generation',
      },
      {
        name: 'media-processing',
      },
    ),
    AudioModule,
    ImageGenerationModule,
    VideoGenerationModule,
    VideoModule,
  ],
  controllers: [],
  providers: [
    QueueService,
    ImageQueueConsumer,
    AudioQueueConsumer,
    VideoQueueProcessor,
    AudioEventListener,
    ImageEventListener,
  ],
  exports: [QueueService],
})
export class QueueModule {}
