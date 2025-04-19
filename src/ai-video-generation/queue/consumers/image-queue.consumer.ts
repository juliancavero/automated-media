import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';
import { Job } from 'bullmq';
import { ImageGenerationService } from 'src/ai-video-generation/images/services/image-generation.service';

interface ImageGenerationJob {
  text: string;
  id: string;
}

@Processor('image-generation')
export class ImageQueueConsumer extends WorkerHost {
  private readonly logger = new Logger(ImageQueueConsumer.name);

  constructor(private readonly imageGenerationService: ImageGenerationService) {
    super();
  }

  async process(job: Job<ImageGenerationJob>) {
    const { text, id } = job.data;

    try {
      const imageUrl = await this.imageGenerationService.generateImageFromText(
        text,
        id,
      );

      this.logger.log(`Image generated successfully: ${imageUrl}`);
      return { success: true, ...job.data };
    } catch (error) {
      this.logger.error(
        `Failed to process image generation job ${job.id}: ${error.message}`,
        error.stack,
      );
      throw error;
    }
  }
}
