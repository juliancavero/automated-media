import {
  Controller,
  Get,
  Param,
  Logger,
  Res,
  Render,
  Post,
  Delete,
} from '@nestjs/common';
import { Response } from 'express';
import { ImageService } from '../services/image.service';
import { Image } from '../schemas/image.schema';

@Controller('images')
export class ImageController {
  private readonly logger = new Logger(ImageController.name);

  constructor(private readonly imageService: ImageService) { }

  @Post()
  async createImage(
    @Param('text') text: string,
    @Param('videoId') videoId: string,
    @Param('order') order: number,
  ): Promise<Image> {
    return await this.imageService.createImage(text, videoId, order);
  }

  @Delete(':id')
  async deleteImage(@Param('id') id: string): Promise<void> {
    return await this.imageService.deleteImage(id);
  }

  @Post('relaunch-failed')
  async relaunchFailedImages(): Promise<{ success: boolean; message: string }> {
    try {
      await this.imageService.relaunchFailedImages();
      return { success: true, message: 'Failed image tasks have been requeued' };
    } catch (error) {
      return { success: false, message: `Error: ${error.message}` };
    }
  }

  // Views
  @Get('list')
  @Render('ai-video-generation/image-list')
  async getImagesListView(@Res() res: Response) {
    const images = await this.imageService.getAllImages();
    return {
      title: 'Image List',
      images,
    };
  }

  @Get('list/:id')
  @Render('ai-video-generation/image-details')
  async getImageDetailView(@Param('id') id: string, @Res() res: Response) {
    const image = await this.imageService.getImageById(id);
    if (!image) {
      return res.status(404).render('no-content', {
        message: 'Image not found',
        type: 'image',
      });
    }
    return {
      title: 'Image Details',
      image,
    };
  }
}
