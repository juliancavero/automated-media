import { Controller, Post, Logger } from '@nestjs/common';
import { SchedulerService } from './scheduler.service';

@Controller('scheduler')
export class SchedulerController {
  private readonly logger = new Logger(SchedulerController.name);

  constructor(private readonly schedulerService: SchedulerService) {}

  @Post('generate-description')
  async triggerGenerateDescription() {
    this.logger.log('Manually triggering video description generation');
    await this.schedulerService.handleGenerateDescriptionCron();
    return { message: 'Description generation task triggered successfully' };
  }
}
