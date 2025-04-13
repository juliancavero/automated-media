import { InjectQueue } from '@nestjs/bullmq';
import { Injectable, Logger } from '@nestjs/common';
import { Queue } from 'bullmq';

@Injectable()
export class AudioQueueService {
  private readonly logger = new Logger(AudioQueueService.name);

  constructor(
    @InjectQueue('audio-generation') private readonly audioQueue: Queue,
  ) {}

  async addAudioGenerationJob(
    text: string,
    voice: string,
    videoId: string,
    order: number,
  ): Promise<{ jobId: string }> {
    this.logger.log(
      `Adding audio generation job to queue with text: ${text}, videoId: ${videoId}, order: ${order}`,
    );

    try {
      const job = await this.audioQueue.add(
        'generate-audio',
        { text, voice, videoId, order },
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

      this.logger.log(`Audio generation job added with ID: ${job.id}`);
      return { jobId: job.id || '' };
    } catch (error) {
      this.logger.error(
        `Failed to add audio generation job to queue: ${error.message}`,
        error.stack,
      );
      throw error;
    }
  }

  async getJobStatus(jobId: string): Promise<any> {
    try {
      const job = await this.audioQueue.getJob(jobId);

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
