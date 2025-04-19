import { Controller, Delete, Get, Param, Render, Res, Post } from '@nestjs/common';
import { Response } from 'express';
import { AudioService } from '../services/audio.service';

@Controller('audios')
export class AudioController {
  constructor(private readonly audioService: AudioService) { }

  @Delete(':id')
  async deleteAudio(@Param('id') id: string): Promise<void> {
    return await this.audioService.deleteAudio(id);
  }

  @Post('relaunch-failed')
  async relaunchFailedAudios(): Promise<{ success: boolean; message: string }> {
    try {
      await this.audioService.relaunchFailedAudios();
      return { success: true, message: 'Failed audio tasks have been requeued' };
    } catch (error) {
      return { success: false, message: `Error: ${error.message}` };
    }
  }

  // Views
  @Get('list')
  @Render('ai-video-generation/audio-list')
  async getAudiosListView(@Res() res: Response) {
    const audios = await this.audioService.getAllAudios();
    return {
      title: 'Audio List',
      audios,
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
