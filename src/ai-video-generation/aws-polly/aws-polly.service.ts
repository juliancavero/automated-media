import { Injectable, Logger } from '@nestjs/common';
import * as AWS from 'aws-sdk';
import { SynthesizeSpeechInput } from 'aws-sdk/clients/polly';
import { v4 as uuidv4 } from 'uuid';
import { ConfigService } from '@nestjs/config';
import { TextToSpeechOptions } from './interfaces/text-to-speech-options.interface';
import { validateAWSConfig } from './utils/aws-config';
import { CreateStoredAudioDto } from '../audio/dto/create-stored-audio.dto';

const DEFAULT_CONFIG: TextToSpeechOptions = {
  voiceId: 'Joanna',
  outputFormat: 'mp3',
  languageCode: 'en-US',
  engine: 'standard',
};

@Injectable()
export class AwsPollyService {
  private readonly logger = new Logger(AwsPollyService.name);
  private readonly polly: AWS.Polly;
  private readonly isConfigured: boolean;

  constructor(private readonly configService: ConfigService) {
    // Initialize AWS configuration
    this.isConfigured = this.initializeAWS();
    this.polly = new AWS.Polly({ apiVersion: '2016-06-10' });
  }

  /**
   * Initialize AWS configuration using ConfigService
   * @returns boolean indicating if the configuration is valid
   */
  private initializeAWS(): boolean {
    // Set AWS SDK to load credentials from shared credentials file
    process.env.AWS_SDK_LOAD_CONFIG = '1';

    try {
      // Configure AWS SDK from environment variables
      const accessKeyId = this.configService.get<string>('AWS_ACCESS_KEY_ID');
      const secretAccessKey = this.configService.get<string>(
        'AWS_SECRET_ACCESS_KEY',
      );
      const region = this.configService.get<string>('AWS_REGION', 'us-east-1');

      if (!accessKeyId || !secretAccessKey) {
        this.logger.warn(
          'AWS credentials not properly configured in environment variables. AWS Polly service will not work correctly.',
        );
        return false;
      }

      AWS.config.update({ accessKeyId, secretAccessKey, region });

      // Validate the configuration
      validateAWSConfig()
        .then((isValid) => {
          if (!isValid) {
            this.logger.warn(
              'AWS credentials validation failed. Service may not work correctly.',
            );
          } else {
            this.logger.log('AWS credentials validated successfully');
          }
        })
        .catch((err) => {
          this.logger.error(`Error validating AWS credentials: ${err.message}`);
        });

      return true;
    } catch (error) {
      this.logger.error(
        `Error configuring AWS SDK: ${error.message}`,
        error.stack,
      );
      return false;
    }
  }

  /**
   * Converts a text string to speech audio file
   * @param text String to convert to speech
   * @param options Optional configuration for AWS Polly
   * @returns Promise with array of data for storage
   */
  async convertTextsToSpeech(
    text: string,
    options?: TextToSpeechOptions,
  ): Promise<CreateStoredAudioDto> {
    const mergedOptions: TextToSpeechOptions = {
      ...DEFAULT_CONFIG,
      ...options,
    };

    if (!this.isConfigured) {
      this.logger.error(
        'AWS Polly is not properly configured. Cannot convert text to speech.',
      );
      throw new Error('AWS Polly service is not properly configured');
    }

    this.logger.log(
      `Converting text to speech: "${text.substring(0, 50)}${text.length > 50 ? '...' : ''}"`,
    );

    try {
      // Generate unique filename
      const filename = `speech_${uuidv4()}.${mergedOptions.outputFormat || 'mp3'}`;

      // Convert text to speech using the AWS Polly service
      const audioData = await this.synthesizeSpeech(
        text,
        this.mapOptionsToPollyParams(mergedOptions),
      );

      // Prepare storage data object
      const createStoredAudioDto: CreateStoredAudioDto = {
        originalText: text,
        audioData: audioData.toString('base64'),
        mimeType: this.getMimeType(mergedOptions.outputFormat || 'mp3'),
        format: mergedOptions.outputFormat || 'mp3',
        voiceId: mergedOptions.voiceId,
        languageCode: mergedOptions.languageCode,
        engine: mergedOptions.engine,
        fileName: filename,
      };
      this.logger.log(`Generated audio for text successfully`);

      return createStoredAudioDto;
    } catch (error) {
      this.logger.error(
        `Error converting text to speech: ${error.message}`,
        error.stack,
      );
      // Rethrow the error to be handled by the caller
      throw error;
    }
  }

  /**
   * Maps our service options to AWS Polly parameters
   */
  private mapOptionsToPollyParams(
    options: TextToSpeechOptions,
  ): SynthesizeSpeechInput {
    const params: SynthesizeSpeechInput = {
      Text: '', // Will be set for each text
      OutputFormat: options.outputFormat || 'mp3',
      VoiceId: options.voiceId || 'Joanna',
      LanguageCode: options.languageCode,
      Engine: options.engine || 'standard',
      TextType: 'text',
    };

    // Add SampleRate only for audio formats
    if (['mp3', 'ogg_vorbis', 'pcm'].includes(params.OutputFormat)) {
      params.SampleRate = '22050';
    }

    // Add SpeechMarkTypes only for json format
    if (params.OutputFormat === 'json') {
      params.SpeechMarkTypes = ['sentence'];
    }

    return params;
  }

  /**
   * Get MIME type based on the format
   */
  private getMimeType(format: string): string {
    switch (format) {
      case 'mp3':
        return 'audio/mpeg';
      case 'ogg_vorbis':
        return 'audio/ogg';
      case 'pcm':
        return 'audio/wav';
      default:
        return 'application/octet-stream';
    }
  }

  /**
   * Synthesizes speech from text using AWS Polly and returns the audio data
   */
  private async synthesizeSpeech(
    text: string,
    baseParams: SynthesizeSpeechInput,
  ): Promise<Buffer> {
    // Create params with the current text
    const params: SynthesizeSpeechInput = {
      ...baseParams,
      Text: text,
    };

    try {
      // Request speech synthesis
      const data = await this.polly.synthesizeSpeech(params).promise();

      // Return audio stream
      if (data.AudioStream instanceof Buffer) {
        return data.AudioStream;
      } else {
        throw new Error('Audio stream is not a Buffer');
      }
    } catch (error) {
      this.logger.error(`AWS Polly error: ${error.message}`, error.stack);
      throw error;
    }
  }
}
