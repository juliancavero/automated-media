import { Injectable, Logger } from '@nestjs/common';
import { AwsPollyService } from '../../../external/aws-polly/aws-polly.service';
import { AudioService } from './audio.service';
import { CloudinaryService } from 'src/external/cloudinary/cloudinary.service';
import { isValidObjectId } from 'mongoose';
import { Languages } from 'src/ai-video-generation/types';

@Injectable()
export class AudioGenerationService {
  private readonly logger = new Logger(AudioGenerationService.name);

  constructor(
    private readonly awsPollyService: AwsPollyService,
    private readonly audioService: AudioService,
    private readonly cloudinaryService: CloudinaryService,
  ) {}

  async generateAudioFromText(
    text: string,
    audioId: string,
    lang: Languages,
  ): Promise<string> {
    this.logger.log(`Generating audio for text: ${text}`);

    try {
      // Call AWS Polly service to convert text to speech
      const audioResult = await this.awsPollyService.convertTextsToSpeech(
        text,
        lang,
      );

      if (!audioResult) {
        throw new Error('Failed to generate audio with AWS Polly');
      }

      const uploadResult = await this.cloudinaryService.upload(audioResult);

      if (!uploadResult) {
        this.logger.error('Failed to upload audio to Cloudinary');
        throw new Error('Failed to upload audio to Cloudinary');
      }

      // if audioId is not provided or is not an instance of ObjectId, just return uploadResult.url
      if (!audioId || !isValidObjectId(audioId)) {
        this.logger.log(
          'No valid audioId provided, returning Cloudinary URL directly',
        );
        return uploadResult.url;
      }

      const audio = await this.audioService.setAudioUrl(
        audioId,
        uploadResult.url,
        uploadResult.public_id,
      );
      if (!audio) {
        this.logger.error('Failed to save audio data to MongoDB');
        throw new Error('Failed to save audio data to MongoDB');
      }

      return audio.url ?? '';
    } catch (error) {
      this.logger.error(
        `Error generating audio: ${error.message}`,
        error.stack,
      );
      throw error;
    }
  }
}
