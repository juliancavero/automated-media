import { Controller, Delete, Get, Param, Render, Res } from '@nestjs/common';
import { Response } from 'express';
import { Audio } from '../schemas/audio.schema';
import { AudioService } from '../services/audio.service';

@Controller('audios')
export class AudioController {
  constructor(private readonly audioService: AudioService) {}

  /* @Get()
  async getAllAudios(): Promise<Audio[]> {
    return await this.audioService.getAllAudios();
  }

  @Get(':id')
  async getAudioById(
    @Param('id') id: string,
    @Res() res: Response,
  ): Promise<Audio | void> {
    const audio = await this.audioService.getAudioById(id);
    if (!audio) {
      res.status(404).send('Audio not found');
      return;
    }

    return audio;
  } */

  @Delete(':id')
  async deleteAudio(@Param('id') id: string): Promise<void> {
    return await this.audioService.deleteAudio(id);
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
