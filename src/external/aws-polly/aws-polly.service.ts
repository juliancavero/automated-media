import { Injectable, Logger } from '@nestjs/common';
import {
  PollyClient,
  SynthesizeSpeechCommand,
  SynthesizeSpeechCommandInput
} from '@aws-sdk/client-polly';
import { v4 as uuidv4 } from 'uuid';
import { ConfigService } from '@nestjs/config';
import { TextToSpeechOptions } from './interfaces/text-to-speech-options.interface';
import { validateAWSConfig } from './utils/aws-config';
import { PollyConfigService } from './services/polly-config.service';

const DEFAULT_CONFIG: TextToSpeechOptions = {
  voiceId: 'Joanna',
  outputFormat: 'mp3',
  languageCode: 'en-US',
  engine: 'standard',
};

@Injectable()
export class AwsPollyService {
  private readonly logger = new Logger(AwsPollyService.name);
  private readonly polly: PollyClient;
  private readonly isConfigured: boolean;

  constructor(
    private readonly configService: ConfigService,
    private readonly pollyConfigService: PollyConfigService,
  ) {
    // Initialize AWS configuration
    this.isConfigured = this.initializeAWS();
    this.polly = new PollyClient({
      region: this.configService.get<string>('AWS_REGION', 'us-east-1')
    });
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

      // The credentials will be picked up automatically from environment variables
      // by the SDK v3, no need to explicitly configure them

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
  ): Promise<Buffer> {
    // Try to get configuration from database
    let dbConfig = {};
    try {
      const configFromDb = await this.pollyConfigService.getCurrentConfig();
      if (configFromDb) {
        dbConfig = {
          voiceId: configFromDb.voiceId,
          languageCode: configFromDb.languageCode,
        };
        this.logger.log(
          `Using Polly configuration from database: voiceId=${configFromDb.voiceId}, languageCode=${configFromDb.languageCode}`,
        );
      }
    } catch (error) {
      this.logger.warn(
        `Could not retrieve Polly configuration from database: ${error.message}`,
      );
    }

    const mergedOptions: TextToSpeechOptions = {
      ...DEFAULT_CONFIG,
      ...dbConfig,
      ...options,
    };

    if (!this.isConfigured) {
      this.logger.error(
        'AWS Polly is not properly configured. Cannot convert text to speech.',
      );
      throw new Error('AWS Polly service is not properly configured');
    }

    this.logger.log(
      `Converting text to speech: "${text.substring(0, 50)}${text.length > 50 ? '...' : ''
      }"`,
    );

    try {
      // Generate unique filename
      const filename = `speech_${uuidv4()}.${mergedOptions.outputFormat || 'mp3'}`;

      // Convert text to speech using the AWS Polly service
      const audioData = await this.synthesizeSpeech(
        text,
        this.mapOptionsToPollyParams(mergedOptions),
      );

      this.logger.log(`Generated audio for text successfully`);

      return audioData;
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
  ): SynthesizeSpeechCommandInput {
    const params: SynthesizeSpeechCommandInput = {
      Text: '', // Will be set for each text
      OutputFormat: options.outputFormat || 'mp3',
      VoiceId: options.voiceId || 'Joanna',
      LanguageCode: options.languageCode,
      Engine: options.engine || 'standard',
      TextType: 'text',
    };

    // Add SampleRate only for audio formats
    if (['mp3', 'ogg_vorbis', 'pcm'].includes(params.OutputFormat || '')) {
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
    baseParams: SynthesizeSpeechCommandInput,
  ): Promise<Buffer> {
    // Create params with the current text
    const params: SynthesizeSpeechCommandInput = {
      ...baseParams,
      Text: text,
    };

    try {
      // Request speech synthesis using v3 SDK
      const command = new SynthesizeSpeechCommand(params);
      const response = await this.polly.send(command);

      // Return audio stream
      if (response.AudioStream) {
        // Convert the Uint8Array or Blob to Buffer
        // The AudioStream is actually a Readable stream in node.js environment
        // or a Blob in browser environment
        if (response.AudioStream instanceof Uint8Array) {
          return Buffer.from(response.AudioStream);
        } else {
          // For Node.js environment, we need to read the stream
          const stream = response.AudioStream as unknown as NodeJS.ReadableStream;
          return new Promise<Buffer>((resolve, reject) => {
            const chunks: Buffer[] = [];
            stream.on('data', (chunk) => chunks.push(Buffer.from(chunk)));
            stream.on('error', (err) => reject(err));
            stream.on('end', () => resolve(Buffer.concat(chunks)));
          });
        }
      } else {
        throw new Error('Audio stream is empty or not available');
      }
    } catch (error) {
      this.logger.error(`AWS Polly error: ${error.message}`, error.stack);
      throw error;
    }
  }
}
