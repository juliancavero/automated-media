import {
  OnQueueEvent,
  QueueEventsHost,
  QueueEventsListener,
} from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';
import { TextToSpeechOptions } from 'src/external/aws-polly/interfaces/text-to-speech-options.interface';
import { VideoGenerationService } from 'src/ai-video-generation/videos/services/video-generation.service';

interface AudioGenerationJob {
  text: string;
  videoId: string;
  order: number;
  options?: TextToSpeechOptions;
}

/** OLD - DO NOT USE */
@QueueEventsListener('audio-generation')
export class AudioEventListener extends QueueEventsHost {
  private readonly logger = new Logger(AudioEventListener.name);

  constructor(private readonly videoGenerationService: VideoGenerationService) {
    super();
  }

  /* @OnQueueEvent('completed')
  async onCompleted(job: { jobId: string; returnvalue: AudioGenerationJob }) {
    const { videoId } = job.returnvalue;
    this.logger.warn(`Job completed with videoId: ${videoId}`);
    this.logger.warn(`Job is: ${JSON.stringify(job)}`);
    const videoGeneration = await this.videoGenerationService.findById(videoId);
    if (!videoGeneration) {
      this.logger.error(`Video generation not found for videoId: ${videoId}`);
      return;
    }

    if (videoGeneration) {
      this.logger.log(
        'Video generation found with jobs: ',
        videoGeneration.jobs,
      );
      videoGeneration.jobs = videoGeneration.jobs.filter(
        (jobList) => jobList !== job.jobId,
      );
      this.logger.log('Filtered jobs: ', videoGeneration.jobs);

      await this.videoGenerationService.update(videoId, videoGeneration);
    }
  } */
}
