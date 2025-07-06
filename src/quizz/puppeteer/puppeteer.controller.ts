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
        message: 'Video recorded successfully',
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
        message: 'Quiz video recorded successfully',
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
    const filePath = `/tmp/${filename}`;

    if (!fs.existsSync(filePath)) {
      throw new HttpException('Video file not found', HttpStatus.NOT_FOUND);
    }

    res.setHeader('Content-Type', 'video/webm');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);

    const fileStream = fs.createReadStream(filePath);
    fileStream.pipe(res);
  }

  @Post('convert')
  async convertVideo(@Body() body: { inputPath: string; outputPath?: string }) {
    try {
      const mp4Path = await this.puppeteerService.convertWebMToMP4(
        body.inputPath,
        body.outputPath,
      );
      return {
        success: true,
        mp4Path,
        message: 'Video converted successfully',
      };
    } catch (error) {
      throw new HttpException(
        `Failed to convert video: ${error.message}`,
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  @Post('record-and-convert')
  async recordAndConvertQuiz(
    @Body() body: { url: string; webmPath?: string; mp4Path?: string },
  ) {
    try {
      const result = await this.puppeteerService.recordAndConvertQuizVideo(
        body.url,
        body.webmPath,
        body.mp4Path,
      );
      return {
        success: true,
        ...result,
        message: 'Video recorded and converted successfully',
      };
    } catch (error) {
      throw new HttpException(
        `Failed to record and convert video: ${error.message}`,
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  @Post('record-and-convert-quiz/:id')
  async recordAndConvertQuizById(
    @Param('id') id: string,
    @Body() body: { baseUrl?: string } = {},
  ) {
    try {
      const result = await this.puppeteerService.recordAndConvertQuizById(
        id,
        body.baseUrl,
      );
      return {
        success: true,
        ...result,
        message: 'Quiz video recorded and converted successfully',
      };
    } catch (error) {
      throw new HttpException(
        `Failed to record and convert quiz video: ${error.message}`,
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }
}
