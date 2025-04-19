import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { BullModule } from '@nestjs/bullmq';
import { AudioGenerationService } from './services/audio-generation.service';
import { AwsPollyModule } from '../../external/aws-polly/aws-polly.module';
import { AudioController } from './controllers/audio.controller';
import { Audio, AudioSchema } from './schemas/audio.schema';
import { AudioService } from './services/audio.service';
import { AudioQueueService } from './queues/audio-queue.service';
import { CloudinaryModule } from 'src/external/cloudinary/cloudinary.module';
import { AudioGenerationController } from './controllers/audio-generation.controller';

@Module({
  imports: [
    MongooseModule.forFeature([{ name: Audio.name, schema: AudioSchema }]),
    BullModule.registerQueue({
      name: 'audio-generation',
    }),
    AwsPollyModule,
    CloudinaryModule,
  ],
  controllers: [AudioController, AudioGenerationController],
  providers: [AudioGenerationService, AudioService, AudioQueueService],
  exports: [AudioGenerationService, AudioService, AudioQueueService],
})
export class AudioModule {}
