import {
  Controller,
  Delete,
  Get,
  Param,
  Render,
  Res,
  Post,
  Query,
} from '@nestjs/common';
import { Response } from 'express';
import { AudioService } from '../services/audio.service';
import { Languages, Status } from 'src/ai-video-generation/types';

@Controller('audios')
export class AudioController {
  constructor(private readonly audioService: AudioService) {}

  @Delete(':id')
  async deleteAudio(
    @Param('id') id: string,
  ): Promise<{ success: boolean; message: string }> {
    try {
      await this.audioService.deleteAudio(id);
      return { success: true, message: 'Audio deleted successfully' };
    } catch (error) {
      return { success: false, message: `Error: ${error.message}` };
    }
  }

  @Post('relaunch-failed')
  async relaunchFailedAudios(): Promise<{ success: boolean; message: string }> {
    try {
      await this.audioService.relaunchFailedAudios();
      return {
        success: true,
        message: 'Failed audio tasks have been requeued',
      };
    } catch (error) {
      return { success: false, message: `Error: ${error.message}` };
    }
  }

  @Post(':id/regenerate')
  async regenerateAudio(
    @Param('id') id: string,
  ): Promise<{ success: boolean; message: string }> {
    try {
      await this.audioService.regenerateAudio(id);
      return { success: true, message: 'Audio regeneration has been queued' };
    } catch (error) {
      return { success: false, message: `Error: ${error.message}` };
    }
  }

  @Post(':id/mark-error')
  async markAudioAsError(
    @Param('id') id: string,
  ): Promise<{ success: boolean; message: string }> {
    try {
      const audio = await this.audioService.setStatus(id, Status.ERROR);
      if (!audio) {
        return { success: false, message: 'Audio not found' };
      }
      return { success: true, message: 'Audio marked as failed successfully' };
    } catch (error) {
      return { success: false, message: `Error: ${error.message}` };
    }
  }

  // Views
  @Get('list')
  @Render('ai-video-generation/audio-list')
  async getAudiosListView(
    @Query('page') page = '1',
    @Query('limit') limit = '10',
    @Query('lang') lang = Languages.ES,
    @Res() res: Response,
  ) {
    const pageNumber = parseInt(page, 10) || 1;
    const limitNumber = parseInt(limit, 10) || 10;

    const { audios, total, pages } = await this.audioService.getAllAudios(
      pageNumber,
      limitNumber,
      lang,
    );

    return {
      title: 'Audio List',
      audios,
      lang,
      pagination: {
        currentPage: pageNumber,
        totalPages: pages,
        totalItems: total,
        hasNext: pageNumber < pages,
        hasPrev: pageNumber > 1,
        nextPage: pageNumber + 1,
        prevPage: pageNumber - 1,
      },
    };
  }

  @Get('list/:id')
  @Render('ai-video-generation/audio-details')
  async getAudioDetailView(@Param('id') id: string, @Res() res: Response) {
    const audio = await this.audioService.getAudioById(id);
    if (!audio) {
      return res.status(404).render('no-content', {
        message: 'Audio not found',
        type: 'audio',
      });
    }
    return {
      title: 'Audio Details',
      audio,
    };
  }
}
