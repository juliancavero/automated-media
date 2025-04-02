import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { VideosService } from '../videos/videos.service';

@Injectable()
export class SchedulerService {
  private readonly logger = new Logger(SchedulerService.name);

  constructor(private readonly videosService: VideosService) {}

  /**
   * Run every 3 hours to generate descriptions for videos
   * Times: 00:00, 03:00, 06:00, 09:00, 12:00, 15:00, 18:00, 21:00
   */
  @Cron('0 0 */3 * * *')
  async handleGenerateDescriptionCron() {
    this.logger.log('Running scheduled task to generate video description');

    try {
      const updatedVideo =
        await this.videosService.generateDescriptionForRandomVideo();

      if (updatedVideo) {
        this.logger.log(
          `Successfully generated description for video ${updatedVideo._id}`,
        );
      } else {
        this.logger.log('No videos found without description or task failed');
      }
    } catch (error) {
      this.logger.error(
        `Error in scheduled task: ${error.message}`,
        error.stack,
      );
    }
  }
}
