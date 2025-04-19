import { InjectQueue } from '@nestjs/bullmq';
import { Injectable, Logger } from '@nestjs/common';
import { Queue } from 'bullmq';
import { v4 } from 'uuid';
import { Audio } from '../schemas/audio.schema';

@Injectable()
export class AudioQueueService {
  private readonly logger = new Logger(AudioQueueService.name);

  constructor(
    @InjectQueue('audio-generation') private readonly audioQueue: Queue,
  ) {}

  async addAudioGenerationJob(audio: Audio): Promise<string> {
    const { text, order, _id } = audio;

    try {
      const uuid = v4();
      await this.audioQueue.add(
        'generate-audio',
        { text, id: _id, order },
        {
          attempts: 3,
          backoff: {
            type: 'exponential',
            delay: 5000,
          },
          removeOnComplete: true,
          removeOnFail: false,
          jobId: uuid, // Unique job ID
        },
      );

      return uuid;
    } catch (error) {
      this.logger.error(
        `Failed to add audio generation job to queue: ${error.message}`,
        error.stack,
      );
      throw error;
    }
  }
}
