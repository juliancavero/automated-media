import { Module } from '@nestjs/common';
import { ScheduleModule } from '@nestjs/schedule';
import { VideosModule } from '../videos/videos.module';
import { SchedulerService } from './scheduler.service';
import { SchedulerController } from './scheduler.controller';
import { BrowserModule } from '../browser/browser.module';

@Module({
  imports: [ScheduleModule.forRoot(), VideosModule, BrowserModule],
  providers: [SchedulerService],
  controllers: [SchedulerController],
})
export class SchedulerModule {}
