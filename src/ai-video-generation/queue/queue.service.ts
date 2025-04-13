import { Injectable, Logger } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';

@Injectable()
export class QueueService {
  private readonly logger = new Logger(QueueService.name);

  constructor(
    @InjectQueue('media-processing')
    private readonly mediaProcessingQueue: Queue,
  ) {}

  async addToQueue(type: string, data: any, options?: any): Promise<string> {
    try {
      const job = await this.mediaProcessingQueue.add(
        'media-job',
        { type, data },
        {
          attempts: 3,
          backoff: {
            type: 'exponential',
            delay: 1000,
          },
          ...options,
        },
      );

      this.logger.log(`Job added to queue: ${job.id}`);
      return job.id || '';
    } catch (error) {
      this.logger.error(`Failed to add job to queue: ${error.message}`);
      throw error;
    }
  }

  async getJobStatus(jobId: string): Promise<any> {
    const job = await this.mediaProcessingQueue.getJob(jobId);

    if (!job) {
      return { status: 'not-found' };
    }

    const state = await job.getState();
    const progress = job.progress;

    return {
      id: job.id,
      state,
      progress,
      data: job.data,
      returnvalue: job.returnvalue,
      failedReason: job.failedReason,
    };
  }
}
