import { Module } from '@nestjs/common';
import { VideoController } from './video.controller';
import { VideoBaseService } from './services/video-base.service';
import { VideoGeneratorService } from './services/video-generator.service';
import { FileOperationsService } from './services/file-operations.service';
import { AudioService } from './services/audio.service';

@Module({
  controllers: [VideoController],
  providers: [
    VideoBaseService,
    VideoGeneratorService,
    FileOperationsService,
    AudioService,
  ],
  exports: [VideoBaseService],
})
export class VideoModule {}
