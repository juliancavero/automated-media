import {
  Controller,
  Post,
  Body,
  Param,
  Get,
  Res,
  HttpException,
  HttpStatus,
} from '@nestjs/common';
import { Response } from 'express';
import * as fs from 'fs';
import { PuppeteerService } from './puppeteer.service';

@Controller('puppeteer')
export class PuppeteerController {
  constructor(private readonly puppeteerService: PuppeteerService) {}

  @Post('record')
  async recordQuiz(@Body() body: { url: string; outputPath?: string }) {
    try {
      const videoPath = await this.puppeteerService.recordQuizVideo(
        body.url,
        body.outputPath,
      );

      return {
        success: true,
        videoPath,
        message:
          'Quiz video recorded successfully with Puppeteer Screen Recorder',
      };
    } catch (error) {
      throw new HttpException(
        `Failed to record video: ${error.message}`,
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  @Post('record-quiz/:id')
  async recordQuizById(
    @Param('id') id: string,
    @Body() body: { baseUrl?: string } = {},
  ) {
    try {
      const videoPath = await this.puppeteerService.recordQuizById(
        id,
        body.baseUrl,
      );

      return {
        success: true,
        videoPath,
        message:
          'Quiz video recorded successfully with Puppeteer Screen Recorder',
      };
    } catch (error) {
      throw new HttpException(
        `Failed to record quiz video: ${error.message}`,
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  @Get('download/:filename')
  async downloadVideo(
    @Param('filename') filename: string,
    @Res() res: Response,
  ) {
    const filePath = `/home/julian/Escritorio/personal/automated-media/public/videos/${filename}`;

    if (!fs.existsSync(filePath)) {
      throw new HttpException('Video file not found', HttpStatus.NOT_FOUND);
    }

    res.setHeader('Content-Type', 'video/mp4');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);

    const fileStream = fs.createReadStream(filePath);
    fileStream.pipe(res);
  }
}
