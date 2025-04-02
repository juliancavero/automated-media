import {
  Controller,
  Get,
  Res,
  Logger,
  HttpStatus,
  HttpException,
} from '@nestjs/common';
import { Response } from 'express';
import { VideosService } from './videos.service';

@Controller('video-preview')
export class VideoPreviewController {
  private readonly logger = new Logger(VideoPreviewController.name);

  constructor(private readonly videosService: VideosService) {}

  @Get()
  async getRandomVideoPreview(@Res() res: Response): Promise<void> {
    try {
      const video = await this.videosService.selectRandomVideoWithDescription();

      if (!video) {
        this.logger.warn('No videos found with description and not uploaded');
        res.render('no-videos.hbs', {
          message:
            "No videos found with description that haven't been uploaded yet",
        });
        return;
      }

      this.logger.log(`Rendering preview for video: ${video._id}`);

      res.render('video-preview.hbs', {
        title: 'Video Preview',
        videoUrl: video.url,
        videoId: video._id.toString(),
        description: video.description,
      });
    } catch (error) {
      this.logger.error(
        `Error rendering video preview: ${error.message}`,
        error.stack,
      );
      throw new HttpException(
        'Failed to render video preview',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }
}
