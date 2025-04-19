import { Injectable, Logger } from '@nestjs/common';
import axios from 'axios';
import * as FormData from 'form-data';

@Injectable()
export class VyrioAiService {
  private readonly logger = new Logger(VyrioAiService.name);
  private readonly vyrioAiApiToken: string;

  constructor() {
    this.vyrioAiApiToken = process.env.VYRIOAIAPITOKEN || '';
    if (!this.vyrioAiApiToken) {
      this.logger.error(
        'VYRIOAIAPITOKEN not set. VyrioAi functionality will not work.',
      );
    }
  }

  async createImage(text: string): Promise<Buffer> {
    if (!text) {
      this.logger.error('Prompt is required to create an image.');
      throw new Error('Prompt is required to create an image.');
    }

    this.logger.log(`Creating image with VyrioAi using text: "${text}"...`);
    try {
      const formData = new FormData();
      formData.append('prompt', text);
      formData.append('style', 'realistic');
      formData.append('aspect_ratio', '9:16');

      const response = await axios.post(
        'https://api.vyro.ai/v2/image/generations',
        formData,
        {
          headers: {
            Authorization: `Bearer ${this.vyrioAiApiToken}`,
            ...formData.getHeaders(),
          },
          responseType: 'arraybuffer',
        },
      );

      if (response.status === 200 && response.data) {
        this.logger.log('Successfully created image with VyrioAi');
        return Buffer.from(response.data);
      } else {
        throw new Error(`Failed with status code: ${response.status}`);
      }
    } catch (error) {
      this.logger.error(`Failed to create image: ${error.message}`);
      throw new Error(`Failed to create image: ${error.message}`);
    }
  }
}
