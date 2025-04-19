import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { BullModule } from '@nestjs/bullmq';
import { ImageGenerationController } from './controllers/image-generation.controller';
import { ImageQueueService } from './queues/image-queue.service';
import { Image, ImageSchema } from './schemas/image.schema';
import { ImageGenerationService } from './services/image-generation.service';
import { ImageService } from './services/image.service';
import { ImageController } from './controllers/image.controller';
import { CloudinaryModule } from 'src/external/cloudinary/cloudinary.module';
import { VyrioAiModule } from 'src/external/vyrioai/vyrioai.module';

@Module({
  imports: [
    MongooseModule.forFeature([{ name: Image.name, schema: ImageSchema }]),
    BullModule.registerQueue({
      name: 'image-generation',
    }),
    CloudinaryModule,
    VyrioAiModule,
  ],
  providers: [ImageGenerationService, ImageService, ImageQueueService],
  controllers: [ImageGenerationController, ImageController],
  exports: [ImageGenerationService, ImageService, ImageQueueService],
})
export class ImageModule {}
