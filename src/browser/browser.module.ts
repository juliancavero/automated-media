import { Module } from '@nestjs/common';
import { BrowserController } from './browser.controller';
import { BrowserService } from './browser.service';

@Module({
  providers: [BrowserService],
  controllers: [BrowserController],
  exports: [BrowserService],
})
export class BrowserModule {}
