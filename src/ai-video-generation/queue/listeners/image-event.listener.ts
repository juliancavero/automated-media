import {
  OnQueueEvent,
  QueueEventsHost,
  QueueEventsListener,
} from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';
import { Job } from 'bullmq';
import { VideoGenerationService } from 'src/ai-video-generation/video-generation/video-generation.service';

interface ImageGenerationJob {
  prompt: string;
  videoId: string;
  order: number;
}

@QueueEventsListener('image-generation')
export class ImageEventListener extends QueueEventsHost {
  private readonly logger = new Logger(ImageEventListener.name);

  constructor(private readonly videoGenerationService: VideoGenerationService) {
    super();
  }

  @OnQueueEvent('completed')
  async onCompleted(job: { jobId: string; returnvalue: ImageGenerationJob }) {
    const { videoId } = job.returnvalue;
    this.logger.warn(`Job is: ${JSON.stringify(job)}`);
    const videoGeneration = await this.videoGenerationService.findById(videoId);
    if (videoGeneration) {
      videoGeneration.jobs = videoGeneration.jobs.filter(
        (jobList) => jobList !== job.jobId,
      );
      await this.videoGenerationService.update(videoId, videoGeneration);
    }
  }
}
