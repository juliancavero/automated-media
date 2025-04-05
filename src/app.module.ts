import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { VideosModule } from './videos/videos.module';
import { AppController } from './app.controller';
import { AiModule } from './ai/ai.module';
import { SchedulerModule } from './scheduler/scheduler.module';
import { ConfigModule } from '@nestjs/config';
import { CloudinaryModule } from './cloudinary/cloudinary.module';

@Module({
  imports: [
    ConfigModule.forRoot(),
    MongooseModule.forRoot(process.env.MONGO_URI ?? ''),
    VideosModule,
    AiModule,
    SchedulerModule,
    CloudinaryModule,
  ],
  controllers: [AppController],
  providers: [],
  exports: [],
})
export class AppModule {}
