import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';
import { Job } from 'bullmq';
import { ImageGenerationService } from '../../image-generation/image-generation.service';

interface ImageGenerationJob {
  prompt: string;
  videoId: string;
  order: number;
}

@Processor('image-generation')
export class ImageQueueConsumer extends WorkerHost {
  private readonly logger = new Logger(ImageQueueConsumer.name);

  constructor(private readonly imageGenerationService: ImageGenerationService) {
    super();
  }

  async process(job: Job<ImageGenerationJob>): Promise<string> {
    this.logger.log(
      `Processing image generation job ${job.id} with prompt: ${job.data.prompt}`,
    );

    try {
      const imageUrl = await this.imageGenerationService.generateImageFromText(
        job.data.prompt,
        job.data.videoId,
        job.data.order,
      );

      this.logger.log(`Image generated successfully: ${imageUrl}`);
      return imageUrl;
    } catch (error) {
      this.logger.error(
        `Failed to process image generation job ${job.id}: ${error.message}`,
        error.stack,
      );
      throw error;
    }
  }
}
