import {
  Controller,
  Get,
  Param,
  Render,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { AutomatedMediaService } from './automated-media.service';

@Controller('/automated-media')
export class AutomatedMediaController {
  private readonly logger = new Logger(AutomatedMediaController.name);

  constructor(private readonly automatedMediaService: AutomatedMediaService) { }

  @Get()
  @Render('automated-media/automated-media-list')
  async renderVideoList() {
    try {
      const videos = await this.automatedMediaService.findAll();
      return { videos };
    } catch (error) {
      this.logger.error(`Error fetching videos: ${error.message}`, error.stack);
      return { videos: [], error: 'Failed to load videos' };
    }
  }

  @Get('video/:id')
  @Render('automated-media/automated-media-details')
  async renderVideoDetails(@Param('id') id: string) {
    try {
      const video = await this.automatedMediaService.findOne(id);
      return {
        videoId: video._id,
        videoUrl: video.url,
        description: video.description,
        uploaded: video.uploaded,
      };
    } catch (error) {
      this.logger.error(
        `Error fetching video details: ${error.message}`,
        error.stack,
      );
      if (error instanceof NotFoundException) {
        return { error: `Video not found: ${id}` };
      }
      return { error: 'Failed to load video details' };
    }
  }

  @Get('upload')
  @Render('old/upload-videos')
  async renderUploadPage() {
    return { title: 'Upload Videos' };
  }
}
