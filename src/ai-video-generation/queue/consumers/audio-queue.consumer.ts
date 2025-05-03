import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';
import { Job } from 'bullmq';
import { AudioGenerationService } from '../../audios/services/audio-generation.service';
import { Languages } from 'src/ai-video-generation/types';

interface AudioGenerationJob {
  text: string;
  id: string;
  lang: Languages;
}

@Processor('audio-generation')
export class AudioQueueConsumer extends WorkerHost {
  private readonly logger = new Logger(AudioQueueConsumer.name);

  constructor(private readonly audioGenerationService: AudioGenerationService) {
    super();
  }

  async process(job: Job<AudioGenerationJob>): Promise<any> {
    const { text, id, lang } = job.data;
    this.logger.debug(`Generating audio for text: ${text.substring(0, 30)}...`);

    try {
      const audioUrl = await this.audioGenerationService.generateAudioFromText(
        text,
        id,
        lang,
      );

      this.logger.debug(`Audio: ${id} - URL: ${audioUrl}`);
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
