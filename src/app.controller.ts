import {
  Controller,
  Get,
  Param,
  Render,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { AudioStorageService } from './ai-video-generation/audio/audio-storage.service';
import { VideosService } from './automated-media/videos/videos.service';

@Controller()
export class AppController {
  private readonly logger = new Logger(AppController.name);

  constructor(
    private readonly videosService: VideosService,
    private readonly audioStorageService: AudioStorageService,
  ) {}

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

  @Get('text-to-speech')
  @Render('text-to-speech')
  getTextToSpeechPage() {
    this.logger.log('Accessing text-to-speech page');
    return {
      title: 'Text to Speech',
    };
  }

  @Get('audio-management')
  @Render('audio-management')
  async getAudioManagementPage() {
    this.logger.log('Accessing audio management page');
    try {
      const audios = await this.audioStorageService.getAllAudios();
      return {
        title: 'Audio Management',
        audios: audios.map((audio) => ({
          id: audio._id,
          originalText: audio.originalText,
          url: `/api/audios/${audio._id}`,
          format: audio.format,
          voiceId: audio.voiceId || 'Default',
          createdAt: audio.createdAt,
        })),
      };
    } catch (error) {
      this.logger.error(`Error getting audios: ${error.message}`);
      return {
        title: 'Audio Management',
        error: 'Failed to load audio files',
        audios: [],
      };
    }
  }
}
