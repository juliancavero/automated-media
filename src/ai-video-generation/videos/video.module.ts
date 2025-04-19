import { Module } from '@nestjs/common';
import { VideoService } from './services/video.service';
import { ImageModule } from '../images/image.module';
import { AudioModule } from '../audios/audio.module';
import { MongooseModule } from '@nestjs/mongoose';
import { Video, VideoSchema } from './entities/video.schema';
import { VideoGenerationService } from './services/video-generation.service';
import { CloudinaryModule } from 'src/external/cloudinary/cloudinary.module';
import { VideoController } from './controllers/video.controller';
import { VideoGenerationController } from './controllers/video-generation.controller';

@Module({
  imports: [
    MongooseModule.forFeature([{ name: Video.name, schema: VideoSchema }]),
    VideoModule,
    ImageModule,
    AudioModule,
    CloudinaryModule,
  ],
  controllers: [VideoController, VideoGenerationController],
  providers: [VideoService, VideoGenerationService],
  exports: [VideoService, VideoGenerationService],
})
export class VideoModule {}
