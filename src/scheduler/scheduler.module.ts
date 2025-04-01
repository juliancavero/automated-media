import { Module } from '@nestjs/common';
import { ScheduleModule } from '@nestjs/schedule';
import { VideosModule } from '../videos/videos.module';
import { SchedulerService } from './scheduler.service';
import { SchedulerController } from './scheduler.controller';

@Module({
  imports: [ScheduleModule.forRoot(), VideosModule],
  providers: [SchedulerService],
  controllers: [SchedulerController],
})
export class SchedulerModule {}
