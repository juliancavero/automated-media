import { Body, Controller, Logger, Post, Query, Res } from '@nestjs/common';
import { Response } from 'express';
import { AudioGenerationService } from '../services/audio-generation.service';
import { Languages } from 'src/ai-video-generation/types';
import { Public } from 'src/auth/decorators/public.decorator';
import { ObjectId } from 'mongodb';

@Controller('audio-generation')
export class AudioGenerationController {
  private readonly logger = new Logger(AudioGenerationController.name);

  constructor(
    private readonly audioGenerationService: AudioGenerationService,
  ) {}

  @Post()
  @Public()
  async generateAudio(
    @Query('lang') lang: Languages,
    @Body() body: { text: string },
    @Res() res: Response,
  ) {
    const audio = await this.audioGenerationService.generateAudioFromText(
      body.text,
      'videoId',
      lang,
      '680375d126fe69ba2768db44',
    );

    if (!audio) {
      res.status(500).send('Failed to generate audio');
      return;
    }

    return res.status(200).json({
      message: 'Audio generated successfully',
      audioUrl: `${audio}`,
    });
  }
}
