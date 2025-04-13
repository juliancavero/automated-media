import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';
import { Job } from 'bullmq';
import { AudioGenerationService } from '../../audio/audio-generation.service';
import { TextToSpeechOptions } from 'src/ai-video-generation/aws-polly/interfaces/text-to-speech-options.interface';

interface AudioGenerationJob {
  text: string;
  videoId: string;
  order: number;
  options?: TextToSpeechOptions;
}

@Processor('audio-generation')
export class AudioQueueConsumer extends WorkerHost {
  private readonly logger = new Logger(AudioQueueConsumer.name);

  constructor(private readonly audioGenerationService: AudioGenerationService) {
    super();
  }

  async process(job: Job<AudioGenerationJob>): Promise<any> {
    const { text, videoId, order, options } = job.data;
    this.logger.log(
      `Processing audio generation job ${job.id} for text: ${text.substring(0, 30)}...`,
    );

    try {
      const audioUrl = await this.audioGenerationService.generateAudioFromText(
        text,
        videoId,
        order,
        options,
      );

      this.logger.log(
        `Successfully processed audio job ${job.id}. Audio URL: ${audioUrl}`,
      );
      return { success: true, ...job.data };
    } catch (error) {
      this.logger.error(
        `Error processing audio generation job ${job.id}: ${error.message}`,
        error.stack,
      );
      throw error;
    }
  }
}
