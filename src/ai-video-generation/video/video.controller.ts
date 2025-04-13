import {
  Controller,
  Post,
  Body,
  Logger,
  Res,
  HttpStatus,
} from '@nestjs/common';
import { VideoBaseService } from './services/video-base.service';
import { Response } from 'express';

@Controller('video')
export class VideoController {
  private readonly logger = new Logger(VideoController.name);

  constructor(private readonly videoService: VideoBaseService) {}

  @Post('crear')
  async crearVideo(
    @Body() videoRequest: { imagenes: string[] },
    @Res() response: Response,
  ): Promise<void> {
    try {
      if (!videoRequest.imagenes || videoRequest.imagenes.length === 0) {
        response.status(HttpStatus.BAD_REQUEST).json({
          message: 'You must provide at least one image',
        });
        return;
      }

      this.logger.log(
        `Starting video creation with ${videoRequest.imagenes.length} images and local audios`,
      );

      const result = await this.videoService.crearVideo(videoRequest.imagenes, {
        duration: 5, // Default duration per image (only used if no audio files found)
        format: 'mp4',
      });

      this.logger.log(`Video created successfully. Path: ${result.path}`);

      // Return the file path instead of the buffer
      response.status(HttpStatus.OK).json({
        message: 'Video created successfully',
        path: result.relativePath,
      });
    } catch (error) {
      this.logger.error(`Error creating video: ${error.message}`, error.stack);
      response.status(HttpStatus.INTERNAL_SERVER_ERROR).json({
        message: 'Error creating the video',
        error: error.message,
      });
    }
  }
}
