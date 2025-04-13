import { Injectable, Logger } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import { v4 } from 'uuid';

@Injectable()
export class VideoQueueService {
  private readonly logger = new Logger(VideoQueueService.name);

  constructor(
    @InjectQueue('video-generation-queue')
    private readonly videoQueue: Queue,
  ) {}

  async addVideoConsolidationJob(
    jobIds: string[],
    videoId: string,
  ): Promise<string> {
    try {
      const job = await this.videoQueue.add(
        'video-generation-queue',
        { jobIds, videoId },
        {
          attempts: 10, // Allow multiple attempts
          backoff: {
            type: 'fixed',
            delay: 5000, // 5 second delay between attempts
          },
        },
      );

      this.logger.log(
        `Video consolidation job added to queue: ${job.id} for videoId: ${videoId}`,
      );
      return v4();
    } catch (error) {
      this.logger.error(
        `Failed to add video consolidation job to queue: ${error.message}`,
      );
      throw error;
    }
  }
}
