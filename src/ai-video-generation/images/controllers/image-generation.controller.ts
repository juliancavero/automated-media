import { Controller, Post, Body, Res } from '@nestjs/common';
import { Response } from 'express';
import { ImageGenerationService } from '../services/image-generation.service';

@Controller('image-generation')
export class ImageGenerationController {
  constructor(
    private readonly imageGenerationService: ImageGenerationService,
  ) {}

  @Post('generate')
  async generateImage(@Body() body: { text: string }, @Res() res: Response) {
    const image = await this.imageGenerationService.generateImageFromText(
      body.text,
      'videoId',
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
