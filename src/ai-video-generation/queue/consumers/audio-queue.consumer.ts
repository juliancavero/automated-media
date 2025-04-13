import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';
import { Job } from 'bullmq';
import { AudioGenerationService } from '../../audio/audio-generation.service';
import { PollyVoiceId } from 'src/ai-video-generation/aws-polly/interfaces/text-to-speech-options.interface';

interface AudioGenerationJob {
  text: string;
  voice: PollyVoiceId;
  videoId: string;
  order: number;
}

@Processor('audio-generation')
export class AudioQueueConsumer extends WorkerHost {
  private readonly logger = new Logger(AudioQueueConsumer.name);

  constructor(private readonly audioGenerationService: AudioGenerationService) {
    super();
  }

  async process(job: Job<AudioGenerationJob>): Promise<any> {
    const { text, voice, videoId, order } = job.data;
    this.logger.log(
      `Processing audio generation job ${job.id} for text: ${text.substring(0, 30)}...`,
    );

    try {
      const audioUrl = await this.audioGenerationService.generateAudioFromText(
        text,
        voice,
        videoId,
        order,
      );

      this.logger.log(
        `Successfully processed audio job ${job.id}. Audio URL: ${audioUrl}`,
      );
      return { success: true, audioUrl };
    } catch (error) {
      this.logger.error(
        `Error processing audio generation job ${job.id}: ${error.message}`,
        error.stack,
      );
      throw error;
    }
  }
}
