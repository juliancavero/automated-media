import {
  Controller,
  Post,
  Get,
  Body,
  Param,
  Logger,
  Res,
  HttpException,
  HttpStatus,
} from '@nestjs/common';
import { Response } from 'express';
import { ImageGenerationService } from './image-generation.service';
import { ImageQueueService } from './image-queue.service';

@Controller('images')
export class ImageGenerationController {
  private readonly logger = new Logger(ImageGenerationController.name);

  constructor(
    private readonly imageGenerationService: ImageGenerationService,
    private readonly imageQueueService: ImageQueueService,
  ) {}

  @Get()
  async getAllImages() {
    try {
      return await this.imageGenerationService.getAllImages();
    } catch (error) {
      this.logger.error(`Failed to get all images: ${error.message}`);
      throw new HttpException(
        'Failed to retrieve images',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  @Get('jobs/:id')
  async getJobStatus(@Param('id') id: string): Promise<any> {
    return this.imageQueueService.getJobStatus(id);
  }

  @Get(':id')
  async getImage(@Param('id') id: string, @Res() res: Response): Promise<void> {
    const image = await this.imageGenerationService.getImageById(id);

    if (!image) {
      res.status(404).send('Image not found');
      return;
    }

    res.setHeader('Content-Type', image.mimeType);
    res.send(Buffer.from(image.imageData, 'base64'));
  }

  @Get('view/list')
  async getImagesListView(@Res() res: Response) {
    try {
      const images = await this.imageGenerationService.getAllImages();
      res.render('image-list', { images });
    } catch (error) {
      this.logger.error(`Failed to render images list: ${error.message}`);
      res.status(500).render('error', {
        message: 'Failed to load images list',
        error: error,
      });
    }
  }

  @Get('view/:id')
  async getImageDetailView(@Param('id') id: string, @Res() res: Response) {
    try {
      const image = await this.imageGenerationService.getImageById(id);
      if (!image) {
        return res.status(404).render('no-content', {
          message: 'Image not found',
          type: 'image',
        });
      }
      res.render('image-detail', { image });
    } catch (error) {
      this.logger.error(`Failed to render image details: ${error.message}`);
      res.status(500).render('error', {
        message: 'Failed to load image details',
        error: error,
      });
    }
  }

  @Post('generate')
  async generateImage(@Body() body: { text: string }, @Res() res: Response) {
    const image = await this.imageGenerationService.generateImageFromText(
      body.text,
      'exampleId',
      0,
    );
    if (!image) {
      res.status(500).send('Failed to generate image');
      return;
    }

    return res.status(200).json({
      message: 'Image generated successfully',
      imageUrl: `${image}`,
    });
  }
}
