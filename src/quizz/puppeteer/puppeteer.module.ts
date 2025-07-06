import { Module } from '@nestjs/common';
import { PuppeteerService } from './puppeteer.service';
import { PuppeteerController } from './puppeteer.controller';
import { FFmpegQuizzService } from './ffmpeg.quizz';

@Module({
  providers: [PuppeteerService, FFmpegQuizzService],
  controllers: [PuppeteerController],
  exports: [PuppeteerService],
})
export class PuppeteerModule {}
