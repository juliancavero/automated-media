import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';
import { Job } from 'bullmq';
import { VideoService } from 'src/ai-video-generation/videos/services/video.service';

interface VideoDescriptionGenerationJob {
  videoId: string;
}

@Processor('video-description')
export class VideoQueueConsumer extends WorkerHost {
  private readonly logger = new Logger(VideoQueueConsumer.name);

  constructor(private readonly videoService: VideoService) {
    super();
  }

  async process(job: Job<VideoDescriptionGenerationJob>) {
    const { videoId } = job.data;

    try {
      this.logger.log(
        `Processing description generation for video: ${videoId}`,
      );

      const result =
        await this.videoService.regenerateVideoDescription(videoId);

      if (!result) {
        throw new Error(`Failed to generate description for video: ${videoId}`);
      }

      this.logger.log(
        `Successfully generated description for video: ${videoId}`,
      );
      return { success: true, videoId };
    } catch (error) {
      this.logger.error(
        `Failed to process video description generation job ${job.id}: ${error.message}`,
        error.stack,
      );
      throw error;
    }
  }
}
