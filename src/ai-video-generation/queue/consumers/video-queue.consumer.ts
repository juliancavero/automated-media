import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';
import { Job } from 'bullmq';
import { VideoGenerationService } from '../../video-generation/video-generation.service';
import { VideoService } from 'src/ai-video-generation/video/video.service';
import { ImageGenerationService } from 'src/ai-video-generation/image-generation/image-generation.service';
import { AudioStorageService } from 'src/ai-video-generation/audio/audio-storage.service';

interface VideoJobData {
  videoId: string;
}

@Processor('video-generation-queue')
export class VideoQueueProcessor extends WorkerHost {
  private readonly logger = new Logger(VideoQueueProcessor.name);

  constructor(
    private readonly videoGenerationService: VideoGenerationService,
    private readonly videoService: VideoService,
    private readonly imageService: ImageGenerationService,
    private readonly audioService: AudioStorageService,
  ) {
    super();
  }

  async process(job: Job<VideoJobData>) {
    const { videoId } = job.data;
    this.logger.log(`Processing video consolidation for videoId: ${videoId}`);

    try {
      const videoGeneration =
        await this.videoGenerationService.findById(videoId);
      if (!videoGeneration) {
        this.logger.error(`Video generation not found for videoId: ${videoId}`);
        return { success: false, videoId };
      }
      const jobs = videoGeneration.jobs;
      if (jobs.length > 0) {
        this.logger.log(`Found ${jobs.length} jobs for videoId: ${videoId}`);
        throw new Error('Jobs are still in progress');
      }
      // All jobs are completed
      this.logger.log(
        `All generation jobs completed successfully for videoId: ${videoId}`,
      );

      const images = await this.imageService.findByVideoId(videoId);
      const audios = await this.audioService.findByVideoId(videoId);

      await this.videoService.crearVideo(images, audios);
      return { success: true, videoId };
    } catch (error) {
      this.logger.warn(
        `Video consolidation check failed: ${error.message}. Will retry.`,
      );
      throw error; // Rethrow to trigger retry
    }
  }
}
