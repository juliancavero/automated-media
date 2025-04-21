import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { MongooseModule } from '@nestjs/mongoose';
import { AudioModule } from './ai-video-generation/audios/audio.module';
import { AwsPollyModule } from './external/aws-polly/aws-polly.module';
import { ImageModule } from './ai-video-generation/images/image.module';
import { QueueModule } from './ai-video-generation/queue/queue.module';
import { VideoModule } from './ai-video-generation/videos/video.module';
import { ExternalModule } from './external/external.module';
import { AiModule } from './automated-media/ai/ai.module';
import { CloudinaryModule } from './automated-media/cloudinary/cloudinary.module';
import { GoogleAIUploadModule } from './automated-media/google-ai-upload/google-ai-upload.module';
import { SchedulerModule } from './automated-media/scheduler/scheduler.module';
import { AutomatedMediaModule } from './automated-media/videos/automated-media.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      envFilePath: ['.env.local', '.env'],
    }),
    MongooseModule.forRoot(process.env.MONGO_URI ?? ''),
    AutomatedMediaModule,
    AiModule,
    SchedulerModule,
    CloudinaryModule,
    GoogleAIUploadModule,
    VideoModule,
    AwsPollyModule,
    ImageModule,
    AudioModule,
    QueueModule,
    ExternalModule,
  ],
  controllers: [],
  providers: [],
  exports: [],
})
export class AppModule { }
