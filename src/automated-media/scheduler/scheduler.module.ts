import { Module } from '@nestjs/common';
import { ScheduleModule } from '@nestjs/schedule';
import { SchedulerService } from './scheduler.service';
import { SchedulerController } from './scheduler.controller';
import { AutomatedMediaModule } from '../videos/automated-media.module';

@Module({
  imports: [ScheduleModule.forRoot(), AutomatedMediaModule],
  providers: [SchedulerService],
  controllers: [SchedulerController],
})
export class SchedulerModule {}
