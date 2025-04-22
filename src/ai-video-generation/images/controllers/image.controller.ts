import {
  Controller,
  Get,
  Param,
  Logger,
  Res,
  Render,
  Post,
  Delete,
  Query,
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
  async deleteImage(@Param('id') id: string): Promise<{ success: boolean; message: string }> {
    try {
      await this.imageService.deleteImage(id);
      return { success: true, message: 'Image deleted successfully' };
    } catch (error) {
      this.logger.error(`Error deleting image: ${error.message}`);
      return { success: false, message: `Error: ${error.message}` };
    }
  }

  @Post(':id/regenerate')
  async regenerateImage(@Param('id') id: string): Promise<{ success: boolean; message: string }> {
    try {
      await this.imageService.regenerateImage(id);
      return { success: true, message: 'Image regeneration has been queued' };
    } catch (error) {
      return { success: false, message: `Error: ${error.message}` };
    }
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
  async getImagesListView(@Query('page') page = '1', @Query('limit') limit = '10', @Res() res: Response) {
    const pageNumber = parseInt(page, 10) || 1;
    const limitNumber = parseInt(limit, 10) || 100;

    const { images, total, pages } = await this.imageService.getAllImages(pageNumber, limitNumber);

    return {
      title: 'Image List',
      images,
      pagination: {
        currentPage: pageNumber,
        totalPages: pages,
        totalItems: total,
        hasNext: pageNumber < pages,
        hasPrev: pageNumber > 1,
        nextPage: pageNumber + 1,
        prevPage: pageNumber - 1,
      }
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