import {
  Controller,
  Post,
  Res,
  UploadedFile,
  UseInterceptors,
  Body,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { Response } from 'express';
import { SubtitlesService } from './subtitles.service';

@Controller('subtitles')
export class SubtitlesController {
  constructor(private readonly subtitlesService: SubtitlesService) {}

  @Post('')
  @UseInterceptors(FileInterceptor('file'))
  async generate(
    @UploadedFile() file: Express.Multer.File,
    @Body('language') language: string = 'en',
    @Body('realTexts') realTexts: string,
    @Res() res: Response,
  ) {
    // Validate language - default to 'en' if not valid
    const validLanguage = ['en', 'es'].includes(language) ? language : 'es';

    const realTextsArray = realTexts.split(';;');
    const buffer = await this.subtitlesService.generateTikTokSubsFromBuffer(
      file.buffer,
      file.originalname,
      validLanguage,
      realTextsArray,
    );
    res.setHeader('Content-Type', 'video/mp4');
    res.send(buffer);
  }
}
