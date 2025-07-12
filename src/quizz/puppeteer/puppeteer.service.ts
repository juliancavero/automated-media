import { Injectable, Logger } from '@nestjs/common';
import * as puppeteer from 'puppeteer';
import * as fs from 'fs';
import * as path from 'path';
import { PuppeteerScreenRecorder } from 'puppeteer-screen-recorder';

@Injectable()
export class PuppeteerService {
  private readonly logger = new Logger(PuppeteerService.name);
  private recorder: PuppeteerScreenRecorder | null = null;

  async recordQuizVideo(
    url: string,
    outputPath: string = '/home/julian/Escritorio/personal/automated-media/public/videos/quiz_output.mp4',
  ): Promise<string> {
    let browser: puppeteer.Browser | null = null;
    let page: puppeteer.Page | null = null;

    try {
      await this.ensureOutputDirectory(outputPath);

      browser = await this.launchBrowser();
      page = await this.setupPage(browser, url);

      await this.startRecording(page, outputPath);
      await this.clickStartButton(page);
      await this.waitForCompletion(page);
      await this.stopRecording();

      return await this.validateOutput(outputPath);
    } catch (error) {
      this.logger.error('Error recording quiz video:', error);
      throw error;
    } finally {
      await this.closeBrowser(browser, page);
    }
  }

  private async ensureOutputDirectory(outputPath: string): Promise<void> {
    const dir = path.dirname(outputPath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
  }

  private async launchBrowser(): Promise<puppeteer.Browser> {
    this.logger.log('Launching browser...');

    return await puppeteer.launch({
      headless: false,
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
        '--window-size=500,1200',
        '--window-position=100,50',
        '--no-first-run',
        '--disable-background-timer-throttling',
        '--disable-backgrounding-occluded-windows',
        '--disable-renderer-backgrounding',
        '--disable-features=TranslateUI',
        '--hide-scrollbars',
        '--disable-web-security',
      ],
    });
  }

  private async setupPage(
    browser: puppeteer.Browser,
    url: string,
  ): Promise<puppeteer.Page> {
    const page = await browser.newPage();

    await page.setViewport({
      width: 500,
      height: 900,
      deviceScaleFactor: 1,
    });

    this.logger.log(`Navigating to: ${url}`);
    await page.goto(url, {
      waitUntil: 'networkidle2',
      timeout: 30000,
    });

    await page.bringToFront();
    await this.sleep(3000);

    return page;
  }

  private async startRecording(
    page: puppeteer.Page,
    outputPath: string,
  ): Promise<void> {
    this.logger.log('Starting screen recording...');

    this.recorder = new PuppeteerScreenRecorder(page, {
      followNewTab: false,
      fps: 60,
      videoFrame: {
        width: 500,
        height: 900,
      },
      videoCrf: 18,
      videoCodec: 'libx264',
      videoPreset: 'slow',
      videoBitrate: '1000k',
      autopad: {
        color: '#000000',
      },
      aspectRatio: '9:16',
    });

    await this.recorder.start(outputPath);
    this.logger.log('Screen recording started');
  }

  private async waitForCompletion(page: puppeteer.Page): Promise<void> {
    this.logger.log('Waiting for quiz completion...');

    /* let elementFound = false;
    try {
      await page.waitForSelector('span[data-testid="start-quizz"]', {
        timeout: 10000,
      });
      this.logger.log(
        'Start element found with selector: span[data-testid="start-quizz"]',
      );
      elementFound = true;
    } catch (error) {
      // Not found, continue anyway
    }

    if (!elementFound) {
      this.logger.warn('Start element not found, continuing anyway');
    } */

    // Wait for finish element
    await page.waitForSelector('span[data-testid="end-quizz"]', {
      timeout: 300000,
    });
    this.logger.log(
      'Quiz completion detected, waiting 3 seconds before stopping...',
    );
    await this.sleep(3000);
  }

  private async clickStartButton(page: puppeteer.Page): Promise<void> {
    this.logger.log('Clicking start button...');
    try {
      await this.sleep(2000); // Wait for 2 seconds before clicking
      const startButton = await page.$(
        'button[data-testid="start-quizz-button"]',
      );
      if (startButton) {
        await startButton.click();
        this.logger.log('Start button clicked');
      } else {
        this.logger.warn('Start button not found, skipping click');
      }
    } catch (error) {
      this.logger.error('Error clicking start button:', error);
    }
  }

  private async stopRecording(): Promise<void> {
    this.logger.log('Stopping recording...');

    if (this.recorder) {
      await this.recorder.stop();
      this.recorder = null;
      this.logger.log('Recording stopped');
    }
  }

  private async validateOutput(outputPath: string): Promise<string> {
    await this.sleep(2000);

    for (let attempt = 1; attempt <= 5; attempt++) {
      this.logger.log(
        `Checking output file (attempt ${attempt}/5): ${outputPath}`,
      );

      if (fs.existsSync(outputPath)) {
        const stats = fs.statSync(outputPath);
        this.logger.log(`File size: ${stats.size} bytes`);

        if (stats.size > 1000) {
          this.logger.log(
            `Recording completed: ${outputPath} (${(stats.size / 1024 / 1024).toFixed(2)} MB)`,
          );
          return outputPath;
        }
      }

      if (attempt < 5) {
        await this.sleep(2000 * attempt);
      }
    }

    if (!fs.existsSync(outputPath)) {
      throw new Error(`Output file was not created: ${outputPath}`);
    }

    const stats = fs.statSync(outputPath);
    throw new Error(`Output file too small: ${stats.size} bytes`);
  }

  private async closeBrowser(
    browser: puppeteer.Browser | null,
    page: puppeteer.Page | null,
  ): Promise<void> {
    if (page) {
      try {
        await page.close();
      } catch (e) {
        this.logger.warn('Error closing page:', e);
      }
    }
    if (browser) {
      try {
        await browser.close();
      } catch (e) {
        this.logger.warn('Error closing browser:', e);
      }
    }
  }

  async recordQuizById(
    quizId: string,
    baseUrl: string = 'http://localhost:5173',
  ): Promise<string> {
    const url = `${baseUrl}/quizz/${quizId}`;
    const timestamp = Date.now();
    const outputPath = `/home/julian/Escritorio/personal/automated-media/public/videos/quiz_${quizId}_${timestamp}.mp4`;

    return await this.recordQuizVideo(url, outputPath);
  }

  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}
