import { Injectable, Logger } from '@nestjs/common';
import { chromium, Browser, Page } from '@playwright/test';

@Injectable()
export class BrowserService {
  private readonly logger = new Logger(BrowserService.name);
  private browser: Browser;
  private page: Page | null = null;

  /**
   * Ensures browser and page are open and available
   * @returns Current page object
   */
  private async ensureBrowserIsOpen(): Promise<Page> {
    try {
      if (!this.browser) {
        this.browser = await chromium.launch({ headless: false });
      }

      if (!this.page || this.page.isClosed()) {
        this.page = await this.browser.newPage();
      }

      return this.page;
    } catch (error) {
      this.logger.error(
        `Error ensuring browser is open: ${error.message}`,
        error.stack,
      );
      throw error;
    }
  }

  /**
   * Opens browser if needed and navigates to TikTok upload page
   * @returns Results of the operation
   */
  async openNavigateAndClose(): Promise<{ success: boolean; message: string }> {
    try {
      const page = await this.ensureBrowserIsOpen();
      await page.goto('http://www.tiktok.com/upload');

      return {
        success: true,
        message: 'Successfully navigated to TikTok upload page',
      };
    } catch (error) {
      this.logger.error(
        `Error during TikTok navigation: ${error.message}`,
        error.stack,
      );

      return {
        success: false,
        message: `Failed to navigate to TikTok: ${error.message}`,
      };
    }
  }

  /**
   * Opens browser if needed and navigates to Google
   * @returns Results of the operation
   */
  async navigateToGoogle(): Promise<{ success: boolean; message: string }> {
    try {
      const page = await this.ensureBrowserIsOpen();
      await page.goto('http://www.google.com');

      return {
        success: true,
        message: 'Successfully navigated to Google',
      };
    } catch (error) {
      this.logger.error(
        `Error during Google navigation: ${error.message}`,
        error.stack,
      );

      return {
        success: false,
        message: `Failed to navigate to Google: ${error.message}`,
      };
    }
  }

  /**
   * Opens browser if needed and navigates to TikTok homepage
   * @returns Results of the operation
   */
  async navigateToTikTok(): Promise<{ success: boolean; message: string }> {
    try {
      const page = await this.ensureBrowserIsOpen();
      await page.goto('http://www.tiktok.com');

      return {
        success: true,
        message: 'Successfully navigated to TikTok homepage',
      };
    } catch (error) {
      this.logger.error(
        `Error during TikTok homepage navigation: ${error.message}`,
        error.stack,
      );

      return {
        success: false,
        message: `Failed to navigate to TikTok homepage: ${error.message}`,
      };
    }
  }
}
