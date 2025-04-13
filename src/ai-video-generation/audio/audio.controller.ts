import {
  Controller,
  Delete,
  Get,
  HttpException,
  HttpStatus,
  Logger,
  Param,
  Res,
} from '@nestjs/common';
import { Response } from 'express';
import { AudioStorageService } from './audio-storage.service';
import { AudioQueueService } from './audio-queue.service';

@Controller('api/audios')
export class AudioController {
  private readonly logger = new Logger(AudioController.name);

  constructor(
    private readonly audioStorageService: AudioStorageService,
    private readonly audioQueueService: AudioQueueService,
  ) {}

  @Get()
  async getAllAudios() {
    try {
      return await this.audioStorageService.getAllAudios();
    } catch (error) {
      this.logger.error(`Failed to get all audios: ${error.message}`);
      throw new HttpException(
        'Failed to retrieve audio files',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  @Get(':id')
  async getAudioById(@Param('id') id: string, @Res() res: Response) {
    try {
      const audio = await this.audioStorageService.getAudioById(id);

      if (!audio) {
        throw new HttpException('Audio not found', HttpStatus.NOT_FOUND);
      }

      // Set appropriate content type header based on format
      const contentType =
        audio.format === 'mp3'
          ? 'audio/mpeg'
          : audio.format === 'ogg'
            ? 'audio/ogg'
            : audio.mimeType;

      res.setHeader('Content-Type', contentType);

      // Convert base64 to buffer
      const audioBuffer = Buffer.from(audio.audioData, 'base64');

      return res.send(audioBuffer);
    } catch (error) {
      this.logger.error(`Error serving audio ${id}: ${error.message}`);
      if (error instanceof HttpException) {
        throw error;
      }
      throw new HttpException(
        'Failed to retrieve audio file',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  @Delete(':id')
  async deleteAudio(@Param('id') id: string) {
    try {
      const result = await this.audioStorageService.deleteAudio(id);
      if (!result) {
        throw new HttpException('Audio not found', HttpStatus.NOT_FOUND);
      }
      return { message: 'Audio deleted successfully' };
    } catch (error) {
      if (error instanceof HttpException) {
        throw error;
      }
      this.logger.error(`Failed to delete audio: ${error.message}`);
      throw new HttpException(
        'Failed to delete audio',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  @Get('view/list')
  async getAudiosListView(@Res() res: Response) {
    try {
      const audios = await this.audioStorageService.getAllAudios();
      res.render('audio-list', { audios });
    } catch (error) {
      this.logger.error(`Failed to render audios list: ${error.message}`);
      res.status(500).render('error', {
        message: 'Failed to load audio list',
        error: error,
      });
    }
  }

  @Get('view/:id')
  async getAudioDetailView(@Param('id') id: string, @Res() res: Response) {
    try {
      const audio = await this.audioStorageService.getAudioById(id);
      if (!audio) {
        return res.status(404).render('no-content', {
          message: 'Audio not found',
          type: 'audio',
        });
      }
      res.render('audio-detail', { audio });
    } catch (error) {
      this.logger.error(`Failed to render audio details: ${error.message}`);
      res.status(500).render('error', {
        message: 'Failed to load audio details',
        error: error,
      });
    }
  }

  @Get('queue/jobs/:id')
  async getJobStatus(@Param('id') id: string) {
    try {
      return await this.audioQueueService.getJobStatus(id);
    } catch (error) {
      this.logger.error(`Failed to get job status: ${error.message}`);
      throw new HttpException(
        'Failed to get job status',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }
}
