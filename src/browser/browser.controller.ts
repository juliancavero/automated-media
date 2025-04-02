import { Controller, Post, Logger, Get } from '@nestjs/common';
import { BrowserService } from './browser.service';

@Controller('browser')
export class BrowserController {
  private readonly logger = new Logger(BrowserController.name);

  constructor(private readonly browserService: BrowserService) {}

  @Get('test')
  async automateGoogleVisit() {
    return await this.browserService.openNavigateAndClose();
  }

  @Get('google')
  async navigateToGoogle() {
    return await this.browserService.navigateToGoogle();
  }

  @Get('tiktok')
  async navigateToTikTok() {
    return await this.browserService.navigateToTikTok();
  }
}
