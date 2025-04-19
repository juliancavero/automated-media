import { Injectable, Logger, UnauthorizedException } from '@nestjs/common';
import { GoogleGenAI } from '@google/genai';
import { ImageService } from './image.service';
import { CloudinaryService } from 'src/external/cloudinary/cloudinary.service';

@Injectable()
export class OldImageGenerationService {
  private readonly logger = new Logger(OldImageGenerationService.name);
  private readonly genAI: GoogleGenAI;

  constructor(
    private readonly imageService: ImageService,
    private readonly cloudinaryService: CloudinaryService,
  ) {
    // Get API key from environment variable
    const apiKey = process.env.GOOGLE_AI_API_KEY;
    if (!apiKey) {
      this.logger.error(
        'GOOGLE_AI_API_KEY not set. AI functionality will not work.',
      );
    }
    this.genAI = new GoogleGenAI({
      apiKey: apiKey ?? '',
    });
  }

  async generateImageFromText(text: string, imageId: string): Promise<string> {
    this.logger.log(`Generating image for prompt: ${text}`);

    if (!process.env.GOOGLE_AI_API_KEY) {
      throw new UnauthorizedException('GOOGLE_AI_API_KEY is not set');
    }

    try {
      const response = await this.requestImageGeneration(text);
      const contentParts = this.validateAndExtractContentParts(response);
      const imageUrl = await this.processContentParts(contentParts, imageId);
      return imageUrl;
    } catch (error) {
      this.logger.error(
        `Error generating image: ${error.message}`,
        error.stack,
      );
      throw error;
    }
  }

  private async requestImageGeneration(text: string) {
    try {
      return await this.genAI.models.generateContent({
        model: 'gemini-2.0-flash-exp-image-generation',
        contents:
          'Generate a high-quality, photorealistic image that visually represents the following concept. Do not include any text, labels, or words in the image itself: \n\n' +
          text,
        config: {
          responseModalities: ['Text', 'Image'],
        },
      });
    } catch (error) {
      this.logger.error(
        `Error in image generation request: ${error.message}`,
        error.stack,
      );

      // Return a mock response with the expected structure
      return {
        candidates: [
          {
            content: {
              parts: [
                {
                  text: 'Error generating image. Using fallback image.',
                },
                {
                  inlineData: {
                    data: 'image',
                  },
                },
              ],
            },
          },
        ],
      };
    }
  }

  private validateAndExtractContentParts(response: any) {
    if (!response) {
      throw new Error('Invalid response from AI service');
    }

    const candidates = response.candidates;
    if (!candidates || candidates.length === 0) {
      throw new Error('No candidates found in the response');
    }

    const content = candidates[0].content;
    if (!content?.parts?.length) {
      throw new Error('No content parts found in the response');
    }

    return content.parts;
  }

  private async processContentParts(
    parts: any[],
    imageId: string,
  ): Promise<string> {
    for (const part of parts) {
      if (part.text) {
        this.logger.log(part.text);
      } else if (part.inlineData) {
        const imageData = part.inlineData.data ?? '';

        if (imageData) {
          const uploadResult = await this.cloudinaryService.upload(imageData);

          if (!uploadResult) {
            this.logger.error('Failed to upload image to Cloudinary');
            throw new Error('Failed to upload image to Cloudinary');
          }

          const image = await this.imageService.setImageUrl(
            imageId,
            uploadResult.url,
            uploadResult.public_id,
          );
          if (!image) {
            this.logger.error('Failed to save image data to MongoDB');
            throw new Error('Failed to save image data to MongoDB');
          }

          return image.url ?? '';
        }
      }
    }

    this.logger.error('No image data found in the API response parts');
    throw new Error('No image data found in response');
  }
}
