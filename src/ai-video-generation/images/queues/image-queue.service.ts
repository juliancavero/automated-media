import { InjectQueue } from '@nestjs/bullmq';
import { Injectable, Logger } from '@nestjs/common';
import { Queue } from 'bullmq';
import { v4 } from 'uuid';
import { Image } from '../schemas/image.schema';

@Injectable()
export class ImageQueueService {
  private readonly logger = new Logger(ImageQueueService.name);

  constructor(
    @InjectQueue('image-generation') private readonly imageQueue: Queue,
  ) {}

  async addImageGenerationJob(image: Image): Promise<string> {
    const { text, _id, order } = image;
    try {
      const uuid = v4();
      await this.imageQueue.add(
        'generate-image',
        { text, id: _id, order },
        {
          attempts: 3,
          backoff: {
            type: 'exponential',
            delay: 5000,
          },
          removeOnComplete: true,
          removeOnFail: false,
          jobId: uuid, // Unique job ID
        },
      );

      return uuid;
    } catch (error) {
      this.logger.error(
        `Failed to add image generation job to queue: ${error.message}`,
        error.stack,
      );
      throw error;
    }
  }
}
