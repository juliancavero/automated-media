import { InjectQueue } from '@nestjs/bullmq';
import { Injectable, Logger } from '@nestjs/common';
import { Queue } from 'bullmq';

@Injectable()
export class ImageQueueService {
  private readonly logger = new Logger(ImageQueueService.name);

  constructor(
    @InjectQueue('image-generation') private readonly imageQueue: Queue,
  ) {}

  async addImageGenerationJob(
    text: string,
    videoId: string,
    order: number,
  ): Promise<{ jobId: string }> {
    this.logger.log(
      `Adding image generation job to queue with text: ${text}, videoId: ${videoId}, order: ${order}`,
    );

    try {
      const job = await this.imageQueue.add(
        'generate-image',
        { prompt: text, videoId, order },
        {
          attempts: 3,
          backoff: {
            type: 'exponential',
            delay: 5000,
          },
          removeOnComplete: true,
          removeOnFail: false,
        },
      );

      this.logger.log(`Image generation job added with ID: ${job.id}`);
      return { jobId: job.id || '' };
    } catch (error) {
      this.logger.error(
        `Failed to add image generation job to queue: ${error.message}`,
        error.stack,
      );
      throw error;
    }
  }

  async getJobStatus(jobId: string): Promise<any> {
    try {
      const job = await this.imageQueue.getJob(jobId);

      if (!job) {
        throw new Error(`Job with ID ${jobId} not found`);
      }

      const state = await job.getState();
      const progress = job._progress;
      const result = job.returnvalue;

      return {
        id: job.id,
        state,
        progress,
        result,
        failedReason: job.failedReason,
      };
    } catch (error) {
      this.logger.error(
        `Failed to get job status for ${jobId}: ${error.message}`,
        error.stack,
      );
      throw error;
    }
  }
}
