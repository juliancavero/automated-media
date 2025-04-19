import { Injectable, Logger } from '@nestjs/common';
import { ImageService } from './image.service';
import { CloudinaryService } from 'src/external/cloudinary/cloudinary.service';
import { VyrioAiService } from 'src/external/vyrioai/vyrioai.service';

@Injectable()
export class ImageGenerationService {
  private readonly logger = new Logger(ImageGenerationService.name);

  constructor(
    private readonly imageService: ImageService,
    private readonly cloudinaryService: CloudinaryService,
    private readonly vyrioAiService: VyrioAiService,
  ) {}

  async generateImageFromText(text: string, imageId: string): Promise<string> {
    this.logger.log(`Generating image for prompt: ${text}`);

    try {
      const bufferResponse = await this.vyrioAiService.createImage(text);
      if (!bufferResponse) {
        throw new Error('Failed to generate image with Hugging Face');
      }
      const uploadResult = await this.cloudinaryService.upload(bufferResponse);
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
    } catch (error) {
      this.logger.error(
        `Error generating image: ${error.message}`,
        error.stack,
      );
      throw error;
    }
  }
}
