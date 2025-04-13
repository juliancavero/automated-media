import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { BullModule } from '@nestjs/bullmq';
import { AudioGenerationService } from './audio-generation.service';
import { AudioStorageService } from './audio-storage.service';
import { AudioQueueService } from './audio-queue.service';
import { AwsPollyModule } from '../aws-polly/aws-polly.module';
import { StoredAudio, StoredAudioSchema } from './schemas/stored-audio.schema';
import { AudioController } from './audio.controller';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: StoredAudio.name, schema: StoredAudioSchema },
    ]),
    BullModule.registerQueue({
      name: 'audio-generation',
    }),
    AwsPollyModule,
  ],
  controllers: [AudioController],
  providers: [AudioGenerationService, AudioStorageService, AudioQueueService],
  exports: [AudioGenerationService, AudioStorageService, AudioQueueService],
})
export class AudioModule {}
