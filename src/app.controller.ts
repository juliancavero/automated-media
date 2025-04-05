import {
  Controller,
  Get,
  Param,
  Render,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { VideosService } from './videos/videos.service';

@Controller()
export class AppController {
  private readonly logger = new Logger(AppController.name);

  constructor(private readonly videosService: VideosService) {}

  @Get()
  @Render('video-list')
  async getVideoList() {
    const videos =
      await this.videosService.findVideosWithDescriptionAndNotUploaded();

    return {
      videos,
      formatDate: (date) => {
        return new Date(date).toLocaleString('es-ES', {
          year: 'numeric',
          month: '2-digit',
          day: '2-digit',
          hour: '2-digit',
          minute: '2-digit',
        });
      },
      truncate: (text, length) => {
        if (!text) return '';
        return text.length > length ? text.substring(0, length) + '...' : text;
      },
    };
  }

  @Get('no-description')
  @Render('video-list')
  async getVideosWithoutDescription() {
    const videos =
      await this.videosService.findVideosWithoutDescriptionAndNotUploaded();

    return {
      videos,
      title: 'Videos Sin Descripción',
      formatDate: (date) => {
        return new Date(date).toLocaleString('es-ES', {
          year: 'numeric',
          month: '2-digit',
          day: '2-digit',
          hour: '2-digit',
          minute: '2-digit',
        });
      },
      truncate: (text, length) => {
        if (!text) return '';
        return text.length > length ? text.substring(0, length) + '...' : text;
      },
    };
  }

  @Get('video/:id')
  @Render('video-preview')
  async getVideoById(@Param('id') id: string) {
    try {
      const video = await this.videosService.findOne(id);

      if (!video) {
        throw new NotFoundException(`Video with ID ${id} not found`);
      }

      return {
        title: 'Video Preview',
        videoUrl: video.url,
        videoId: String(video._id),
        description: video.description ?? '',
      };
    } catch (error) {
      this.logger.error(
        `Error getting video by ID: ${error.message}`,
        error.stack,
      );
      throw new NotFoundException(`Video with ID ${id} not found`);
    }
  }

  @Get('post')
  @Render('post')
  getPostPage() {
    this.logger.log('Accessing post page for generating descriptions');
    return {
      title: 'Generate Video Description',
    };
  }

  @Get('upload')
  @Render('upload-videos')
  getUploadPage() {
    this.logger.log('Accessing upload videos page');
    return {
      title: 'Upload Videos',
    };
  }
}
