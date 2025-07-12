import { Module } from '@nestjs/common';
import { PlaywrightService } from './playwright.service';
import { PlaywrightController } from './playwright.controller';
import { FFmpegConverterService } from '../helpers/ffmpeg-converter';

@Module({
  providers: [PlaywrightService, FFmpegConverterService],
  controllers: [PlaywrightController],
  exports: [PlaywrightService],
})
export class PlaywrightModule {}
