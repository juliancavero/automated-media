import { Injectable, Logger } from '@nestjs/common';
import { Readable } from 'stream';
import axios from 'axios';
import { ReplicateImageGenerationResponse } from './response.type';

@Injectable()
export class HuggingFaceService {
  private readonly logger = new Logger(HuggingFaceService.name);
  private readonly huggingFaceApiKey: string;
  constructor() {
    this.huggingFaceApiKey = process.env.HUGGINGFACE_API_KEY || '';
    if (!this.huggingFaceApiKey) {
      this.logger.error(
        'HUGGINGFACE_API_KEY not set. AI functionality will not work.',
      );
    }
  }

  async createImage(text: string): Promise<Buffer> {
    if (!text) {
      this.logger.error('Prompt is required to create an image.');
      throw new Error('Prompt is required to create an image.');
    }

    this.logger.log(`Creating image with text: "${text}"...`);
    try {
      return await this.useReplicate(text);
    } catch (error) {
      this.logger.error(`Failed to create image: ${error.message}`);
      throw new Error(`Failed to create image: ${error.message}`);
    }
  }

  async useReplicate(text: string): Promise<Buffer> {
    const response = await axios.post<ReplicateImageGenerationResponse>(
      'https://router.huggingface.co/replicate/v1/models/black-forest-labs/flux-dev/predictions',
      {
        input: {
          prompt: text,
        },
      },
      {
        headers: {
          Authorization: `Bearer ${this.huggingFaceApiKey}`,
          'Content-Type': 'application/json',
        },
      },
    );

    const data = response.data;
    const streamUrl = data.urls.stream;
    if (!streamUrl) {
      this.logger.error('Stream URL not found in response');
      throw new Error('Stream URL not found in response');
    }

    // Helper function to wait for specified time
    const wait = (ms: number) =>
      new Promise((resolve) => setTimeout(resolve, ms));

    // Maximum number of retries to prevent infinite loops
    const maxRetries = 20; // 100 seconds maximum wait time
    let retries = 0;

    // Polling function to check if image is ready
    async function pollForImage(): Promise<Buffer> {
      try {
        this.logger.log(`Attempting to fetch image, attempt ${retries + 1}...`);
        const imageResponse = await axios.get(streamUrl, {
          responseType: 'arraybuffer',
          headers: {
            Authorization: `Bearer ${this.huggingFaceApiKey}`,
          },
        });

        if (imageResponse.status === 200 && imageResponse.data) {
          this.logger.log('Successfully retrieved image from stream');
          return Buffer.from(imageResponse.data);
        }
      } catch (error) {
        this.logger.log(`Stream not ready yet: ${error.message}`);
      }

      retries++;
      if (retries >= maxRetries) {
        throw new Error('Maximum retries reached. Failed to retrieve image.');
      }

      this.logger.log('Waiting 5 seconds before retrying...');
      await wait(5000);
      return pollForImage.call(this);
    }

    // Start polling for the image
    return pollForImage.call(this);
  }
}
