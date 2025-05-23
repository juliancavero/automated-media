import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';
import { Job } from 'bullmq';
import { AudioService } from 'src/ai-video-generation/audios/services/audio.service';
import { ImageService } from 'src/ai-video-generation/images/services/image.service';
import { Languages, Status } from 'src/ai-video-generation/types';
import { VideoGenerationService } from 'src/ai-video-generation/videos/services/video-generation.service';
import { VideoService } from 'src/ai-video-generation/videos/services/video.service';

interface VideoDescriptionGenerationJob {
  videoId: string;
}

@Processor('video-processing')
export class VideoProcessorQueueConsumer extends WorkerHost {
  private readonly logger = new Logger(VideoProcessorQueueConsumer.name);

  constructor(
    private readonly videoService: VideoService,
    private readonly imageService: ImageService,
    private readonly audioService: AudioService,
    private readonly videoGenerationService: VideoGenerationService,
  ) {
    super();
  }

  async process(job: Job<VideoDescriptionGenerationJob>) {
    try {
      const { videoId } = job.data;
      this.logger.log(`Processing incomplete video ${videoId}`);

      await this.videoService.setStatus(videoId, Status.PROCESSING);

      // Logic similar to crearVideoConTodo
      const video = await this.videoService.findById(videoId);
      if (!video) {
        throw new Error(`Video not found: ${videoId}`);
      }

      const images = await this.imageService.findByVideoId(videoId);
      const audios = await this.audioService.findByVideoId(videoId);

      if (!images || images.length === 0) {
        await this.videoService.setStatus(videoId, Status.ERROR);
        throw new Error(`No images found for video: ${videoId}`);
      }
      if (!audios || audios.length === 0) {
        await this.videoService.setStatus(videoId, Status.ERROR);
        throw new Error(`No audios found for video: ${videoId}`);
      }

      // Generate the video with all images and audios
      await this.videoGenerationService.crearVideo(
        videoId,
        images,
        audios,
        video.lang as Languages,
      );

      await this.videoService.setStatus(videoId, Status.FINISHED);
      return { success: true, videoId };
    } catch (error) {
      await this.videoService.setStatus(job.data.videoId, Status.ERROR);
      this.logger.error(`Error processing video ${job.data.videoId}: ${error}`);
      // wait for 5 seconds before retrying
      await new Promise((resolve) => setTimeout(resolve, 5000));
      // Retry the job
      throw error; // Re-throw the error to mark the job as failed
    }
  }
}
