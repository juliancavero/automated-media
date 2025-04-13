import { Injectable, Logger } from '@nestjs/common';
import { GenerateVideoDto } from './dto/generate-video.dto';
import { AudioQueueService } from '../audio/audio-queue.service';
import { v4 as uuidv4 } from 'uuid';
import { ImageQueueService } from '../image-generation/image-queue.service';

@Injectable()
export class VideoGenerationService {
  private readonly logger = new Logger(VideoGenerationService.name);

  constructor(
    private readonly imageQueue: ImageQueueService,
    private readonly audioQueue: AudioQueueService,
  ) {}

  async generateVideo(generateVideoDto: GenerateVideoDto): Promise<boolean> {
    try {
      const { texts, audioConfig } = generateVideoDto;
      // Generate a unique ID for this video
      const videoId = uuidv4();
      this.logger.log(`Generating video with ID: ${videoId}`);

      // Create image generation tasks
      this.logger.log('Creating image generation tasks');
      for (const [index, text] of texts.entries()) {
        await this.imageQueue.addImageGenerationJob(text, videoId, index);
        this.logger.log(
          `Added image generation task for text ${index + 1} with order ${index}`,
        );
      }

      // Create audio generation tasks
      this.logger.log('Creating audio generation tasks');
      for (const [index, text] of texts.entries()) {
        await this.audioQueue.addAudioGenerationJob(
          text,
          audioConfig.voice,
          videoId,
          index,
        );
        this.logger.log(
          `Added audio generation task for text ${index + 1} with order ${index}`,
        );
      }

      return true;
    } catch (error) {
      this.logger.error(
        `Error generating video: ${error.message}`,
        error.stack,
      );
      return false;
    }
  }
}
