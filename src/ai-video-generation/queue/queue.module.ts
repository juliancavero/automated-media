import { BullModule } from '@nestjs/bullmq';
import { Module } from '@nestjs/common';
import { AudioQueueConsumer } from './consumers/audio-queue.consumer';
import { ImageQueueConsumer } from './consumers/image-queue.consumer';
import { AudioModule } from '../audio/audio.module';
import { ImageGenerationModule } from '../image-generation/image-generation.module';
import { ConfigModule } from '@nestjs/config';

@Module({
  imports: [
    ConfigModule,
    BullModule.forRoot({
      connection: {
        url: process.env.REDIS_URL ?? 'xdxdxd',
      },
    }),
    BullModule.registerQueue(
      {
        name: 'image-generation',
      },
      {
        name: 'audio-generation',
      },
    ),
    ImageGenerationModule,
    AudioModule,
  ],
  providers: [ImageQueueConsumer, AudioQueueConsumer],
})
export class QueueModule {}
