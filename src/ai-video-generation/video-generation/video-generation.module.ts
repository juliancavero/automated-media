import { Module } from '@nestjs/common';
import { VideoGenerationController } from './video-generation.controller';
import { VideoGenerationService } from './video-generation.service';
import { AudioModule } from '../audio/audio.module';
import { ImageGenerationModule } from '../image-generation/image-generation.module';

@Module({
  imports: [ImageGenerationModule, AudioModule],
  controllers: [VideoGenerationController],
  providers: [VideoGenerationService],
  exports: [VideoGenerationService],
})
export class VideoGenerationModule {}
