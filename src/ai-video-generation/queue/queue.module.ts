import { BullModule } from '@nestjs/bullmq';
import { Module } from '@nestjs/common';
import { AudioQueueConsumer } from './consumers/audio-queue.consumer';
import { ImageQueueConsumer } from './consumers/image-queue.consumer';
import { VideoQueueConsumer } from './consumers/video-queue.consumer';
import { AudioModule } from '../audios/audio.module';
import { VideoModule } from '../videos/video.module';
import { ImageModule } from '../images/image.module';
import { VideoProcessorQueueConsumer } from './consumers/video-processor-queue.consumer';

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
        name: 'video-description',
      },
      {
        name: 'video-processing',
      },
    ),
    AudioModule,
    ImageModule,
    VideoModule,
  ],
  controllers: [],
  providers: [
    ImageQueueConsumer,
    AudioQueueConsumer,
    VideoQueueConsumer,
    VideoProcessorQueueConsumer,
  ],
  exports: [],
})
export class QueueModule {}
