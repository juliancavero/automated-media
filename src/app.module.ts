import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { MongooseModule } from '@nestjs/mongoose';
import { AudioModule } from './ai-video-generation/audio/audio.module';
import { AwsPollyModule } from './ai-video-generation/aws-polly/aws-polly.module';
import { ImageGenerationModule } from './ai-video-generation/image-generation/image-generation.module';
import { QueueModule } from './ai-video-generation/queue/queue.module';
import { VideoGenerationModule } from './ai-video-generation/video-generation/video-generation.module';
import { VideoModule } from './ai-video-generation/video/video.module';
import { AppController } from './app.controller';
import { AiModule } from './automated-media/ai/ai.module';
import { CloudinaryModule } from './automated-media/cloudinary/cloudinary.module';
import { GoogleAIUploadModule } from './automated-media/google-ai-upload/google-ai-upload.module';
import { VideosModule } from './automated-media/videos/videos.module';
import { SchedulerModule } from './automated-media/scheduler/scheduler.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      envFilePath: ['.env.local', '.env'],
    }),
    MongooseModule.forRoot(process.env.MONGO_URI ?? ''),
    VideosModule,
    AiModule,
    SchedulerModule,
    CloudinaryModule,
    VideoModule,
    AwsPollyModule,
    ImageGenerationModule,
    AudioModule,
    GoogleAIUploadModule,
    QueueModule,
    VideoGenerationModule,
  ],
  controllers: [AppController],
  providers: [],
  exports: [],
})
export class AppModule {}
