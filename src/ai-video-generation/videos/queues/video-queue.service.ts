import { InjectQueue } from '@nestjs/bullmq';
import { Injectable, Logger } from '@nestjs/common';
import { Queue } from 'bullmq';
import { v4 } from 'uuid';

@Injectable()
export class VideoQueueService {
  private readonly logger = new Logger(VideoQueueService.name);

  constructor(
    @InjectQueue('video-description') private readonly videoQueue: Queue,
    @InjectQueue('video-processing')
    private readonly videoProcessingQueue: Queue,
  ) {}

  async addVideoDescriptionGenerationJob(videoId: string): Promise<string> {
    try {
      const uuid = v4();
      await this.videoQueue.add(
        'generate-description',
        { videoId },
        {
          attempts: 3,
          backoff: {
            type: 'exponential',
            delay: 5000,
          },
          removeOnComplete: true,
          removeOnFail: false,
          jobId: uuid,
        },
      );

      return uuid;
    } catch (error) {
      this.logger.error(
        `Failed to add video description generation job to queue: ${error.message}`,
        error.stack,
      );
      throw error;
    }
  }

  async addBatchVideoGenerationJobs(videoIds: string[]): Promise<string[]> {
    try {
      const jobIds: string[] = [];

      // Add each video with a delay of 1.5 minutes between each job
      for (let i = 0; i < videoIds.length; i++) {
        const uuid = v4();
        await this.videoProcessingQueue.add(
          'process-incomplete-video',
          { videoId: videoIds[i] },
          {
            attempts: 2,
            backoff: {
              type: 'exponential',
              delay: 10000,
            },
            removeOnComplete: true,
            removeOnFail: false,
            jobId: uuid,
            // Delay each job by 1.5 minutes * its position in the queue
            delay: i * 90000, // 90000ms = 1.5 minutes
          },
        );
        jobIds.push(uuid);
        this.logger.log(
          `Added video ${videoIds[i]} to batch processing queue with delay ${i * 1.5} minutes`,
        );
      }

      return jobIds;
    } catch (error) {
      this.logger.error(
        `Failed to add batch video generation jobs to queue: ${error.message}`,
        error.stack,
      );
      throw error;
    }
  }

  async addVideoProcessingJob(videoId: string): Promise<string> {
    try {
      const uuid = v4();

      // Get active jobs to determine delay
      const activeJobs = await this.videoProcessingQueue.getJobs([
        'active',
        'waiting',
        'delayed',
      ]);
      const delayMs = activeJobs.length * 90000; // 90000ms = 1.5 minutes per job

      await this.videoProcessingQueue.add(
        'process-incomplete-video',
        { videoId },
        {
          attempts: 2,
          backoff: {
            type: 'exponential',
            delay: 10000,
          },
          removeOnComplete: true,
          removeOnFail: false,
          jobId: uuid,
          delay: delayMs, // Delay based on current queue length
        },
      );

      this.logger.log(
        `Added video ${videoId} to processing queue with delay of ${delayMs / 60000} minutes`,
      );

      return uuid;
    } catch (error) {
      this.logger.error(
        `Failed to add video processing job to queue: ${error.message}`,
        error.stack,
      );
      throw error;
    }
  }
}
