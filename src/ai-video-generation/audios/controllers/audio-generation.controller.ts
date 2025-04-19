import { Body, Controller, Logger, Post, Res } from '@nestjs/common';
import { Response } from 'express';
import { AudioGenerationService } from '../services/audio-generation.service';

@Controller('audio-generation')
export class AudioGenerationController {
  private readonly logger = new Logger(AudioGenerationController.name);

  constructor(
    private readonly audioGenerationService: AudioGenerationService,
  ) {}

  @Post()
  async generateAudio(@Body() body: { text: string }, @Res() res: Response) {
    const audio = await this.audioGenerationService.generateAudioFromText(
      body.text,
      'videoId',
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
