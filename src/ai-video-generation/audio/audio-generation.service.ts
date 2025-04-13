import { Injectable, Logger } from '@nestjs/common';
import { AwsPollyService } from '../aws-polly/aws-polly.service';
import {
  PollyVoiceId,
  TextToSpeechOptions,
} from '../aws-polly/interfaces/text-to-speech-options.interface';
import { AudioStorageService } from './audio-storage.service';
import { StoredAudio } from './schemas/stored-audio.schema';

@Injectable()
export class AudioGenerationService {
  private readonly logger = new Logger(AudioGenerationService.name);

  constructor(
    private readonly awsPollyService: AwsPollyService,
    private readonly audioStorageService: AudioStorageService,
  ) {}

  async generateAudioFromText(
    text: string,
    voiceId: PollyVoiceId,
    videoId: string,
    order: number,
  ): Promise<string> {
    this.logger.log(`Generating audio for text: ${text}`);

    try {
      // Configure AWS Polly options
      const options: TextToSpeechOptions = {
        voiceId: voiceId || 'Conchita',
        outputFormat: 'mp3',
        languageCode: 'es-ES',
      };

      // Call AWS Polly service to convert text to speech
      const audioResult = await this.awsPollyService.convertTextsToSpeech(
        text,
        options,
      );

      if (!audioResult) {
        throw new Error('Failed to generate audio with AWS Polly');
      }

      this.logger.log(`Audio generated successfully: ${audioResult.fileName}`);

      // Store the audio file
      const storedAudio = await this.audioStorageService.saveAudio(
        audioResult,
        videoId,
        order,
      );

      this.logger.log(`Audio stored successfully with ID: ${storedAudio._id}`);

      return storedAudio.fileName || '';
    } catch (error) {
      this.logger.error(
        `Error generating audio: ${error.message}`,
        error.stack,
      );
      throw error;
    }
  }

  async getAudioById(id: string): Promise<StoredAudio | null> {
    try {
      return await this.audioStorageService.getAudioById(id);
    } catch (error) {
      this.logger.error(
        `Error retrieving audio with ID ${id}: ${error.message}`,
      );
      throw error;
    }
  }
}
