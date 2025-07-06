import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { MongooseModule } from '@nestjs/mongoose';
import { AudioModule } from './ai-video-generation/audios/audio.module';
import { AwsPollyModule } from './external/aws-polly/aws-polly.module';
import { ImageModule } from './ai-video-generation/images/image.module';
import { QueueModule } from './ai-video-generation/queue/queue.module';
import { VideoModule } from './ai-video-generation/videos/video.module';
import { ExternalModule } from './external/external.module';
import { AppController } from './app.controller';
import { AuthModule } from './auth/auth.module';
import { APP_GUARD } from '@nestjs/core';
import { JwtAuthGuard } from './auth/guards/jwt-auth.guard';
import { InitAdminService } from './auth/init-admin.service';
import { CreatedStoriesModule } from './ai-video-generation/created-stories/created-stories.module';
import { QuizzModule } from './quizz/quizz.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      envFilePath: ['.env.local', '.env'],
    }),
    MongooseModule.forRoot(process.env.MONGO_URI ?? ''),
    VideoModule,
    AwsPollyModule,
    ImageModule,
    AudioModule,
    CreatedStoriesModule,
    QueueModule,
    ExternalModule,
    AuthModule,
    QuizzModule,
  ],
  controllers: [AppController],
  providers: [
    {
      provide: APP_GUARD,
      useClass: JwtAuthGuard,
    },
    InitAdminService,
  ],
  exports: [],
})
export class AppModule {}
