import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { BullModule } from '@nestjs/bullmq';
import { ImageGenerationService } from './image-generation.service';
import { ImageGenerationController } from './image-generation.controller';
import {
  GeneratedImage,
  GeneratedImageSchema,
} from './schemas/generated-image.schema';
import { ImageQueueService } from './image-queue.service';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: GeneratedImage.name, schema: GeneratedImageSchema },
    ]),
    BullModule.registerQueue({
      name: 'image-generation',
    }),
  ],
  providers: [ImageGenerationService, ImageQueueService],
  controllers: [ImageGenerationController],
  exports: [ImageGenerationService, ImageQueueService],
})
export class ImageGenerationModule {}
