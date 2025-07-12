import { Injectable, Logger } from '@nestjs/common';
import { chromium, Browser, Page } from 'playwright';
import * as fs from 'fs';
import * as path from 'path';
import { FFmpegConverterService } from '../helpers/ffmpeg-converter';

@Injectable()
export class PlaywrightService {
  private readonly logger = new Logger(PlaywrightService.name);

  constructor(private readonly ffmpegConverter: FFmpegConverterService) {}

  async recordQuizVideo(
    url: string,
    outputPath: string = '/home/julian/Escritorio/personal/automated-media/public/videos/quiz_output.mp4',
  ): Promise<string> {
    let browser: Browser | null = null;
    let page: Page | null = null;

    try {
      await this.ensureOutputDirectory(outputPath);

      browser = await this.launchBrowser();
      page = await this.setupPage(browser, url);

      await this.waitForStartElement(page);

      const webmPath = await this.startRecording(page, outputPath);
      await this.waitForFinishElement(page);

      // Cerrar el contexto aquí para finalizar la grabación
      await this.stopRecording(page);
      await this.closeBrowser(browser, page);

      // Resetear las variables para evitar cerrar dos veces en finally
      browser = null;
      page = null;

      await this.convertToMp4(webmPath, outputPath);

      return outputPath;
    } catch (error) {
      this.logger.error('Error recording quiz video:', error);
      throw error;
    } finally {
      // Solo cerrar si no se cerró ya exitosamente
      if (browser || page) {
        await this.closeBrowser(browser, page);
      }
    }
  }

  async recordQuizById(
    quizId: string,
    baseUrl: string = 'http://localhost:5173',
  ): Promise<string> {
    const url = `${baseUrl}/quizz/${quizId}`;
    const outputPath = `/home/julian/Escritorio/personal/automated-media/public/videos/quiz-${quizId}.mp4`;

    return await this.recordQuizVideo(url, outputPath);
  }

  private async ensureOutputDirectory(outputPath: string): Promise<void> {
    const dir = path.dirname(outputPath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
  }

  private async launchBrowser(): Promise<Browser> {
    this.logger.log(
      'Launching Chromium browser for mobile vertical recording...',
    );

    return await chromium.launch({
      headless: false,
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
        '--disable-web-security',
        '--disable-features=VizDisplayCompositor',
        '--window-size=600,1000', // Ventana más pequeña compensando deviceScaleFactor=2
        '--window-position=50,50',
        '--use-fake-ui-for-media-stream',
        '--use-fake-device-for-media-stream',
        '--autoplay-policy=no-user-gesture-required',
        '--force-device-scale-factor=2', // Simular pantalla retina
        '--high-dpi-support=1',
        '--force-color-profile=srgb',
        '--disable-background-timer-throttling',
        '--disable-backgrounding-occluded-windows',
        '--disable-renderer-backgrounding',
        '--enable-gpu-rasterization',
        '--enable-zero-copy',
      ],
    });
  }

  private async setupPage(browser: Browser, url: string): Promise<Page> {
    // Crear contexto con permisos de audio/video simulando dispositivo móvil
    const context = await browser.newContext({
      viewport: { width: 1080, height: 1920 }, // Resolución móvil vertical estándar
      deviceScaleFactor: 2, // Simular pantalla retina (iPhone, Pixel)
      isMobile: true, // Habilitar modo móvil
      recordVideo: {
        dir: '/tmp/playwright-videos',
        size: { width: 1080, height: 1920 }, // Grabar en resolución móvil
      },
      permissions: ['microphone', 'camera'],
      userAgent:
        'Mozilla/5.0 (iPhone; CPU iPhone OS 14_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/14.0 Mobile/15E148 Safari/604.1',
      colorScheme: 'light',
      reducedMotion: 'no-preference',
      ignoreHTTPSErrors: true,
    });

    const page = await context.newPage();

    // Configurar audio context para capturar sonido
    await page.addInitScript(() => {
      // Habilitar audio en el contexto
      Object.defineProperty(navigator, 'mediaDevices', {
        writable: true,
        value: {
          getUserMedia: () =>
            Promise.resolve({
              getTracks: () => [],
            }),
        },
      });
    });

    this.logger.log(`Navigating to: ${url}`);
    await page.goto(url, {
      waitUntil: 'networkidle',
      timeout: 30000,
    });

    return page;
  }

  private async waitForStartElement(page: Page): Promise<void> {
    this.logger.log('Waiting for start-quizz element...');

    // Intentar múltiples selectores posibles
    const selectors = [
      '[data-testid="start-quizz"]',
      '[data-testid="start-quiz"]',
      'span[data-testid="start-quizz"]',
      'button[data-testid="start-quizz"]',
      '*[name*="start"]',
    ];

    let elementFound = false;

    for (const selector of selectors) {
      try {
        this.logger.log(`Trying selector: ${selector}`);

        // Primero verificar si el elemento ya existe
        const existingElement = await page.$(selector);
        if (existingElement) {
          this.logger.log(
            `Element found immediately with selector: ${selector}`,
          );
          elementFound = true;
          break;
        }

        // Si no existe, esperar a que aparezca
        await page.waitForSelector(selector, {
          timeout: 10000, // 10 segundos por selector
        });

        this.logger.log(`Element found with selector: ${selector}`);
        elementFound = true;
        break;
      } catch (error) {
        this.logger.warn(`Selector ${selector} failed:`, error.message);
        continue;
      }
    }

    if (!elementFound) {
      // Como último recurso, buscar cualquier elemento que contenga texto relacionado
      this.logger.log('Trying text-based search...');
      try {
        await page.waitForSelector('text=/start/i', { timeout: 10000 });
        this.logger.log('Found element with start text');
        elementFound = true;
      } catch (error) {
        this.logger.warn('Text-based search failed:', error.message);
      }
    }

    if (!elementFound) {
      // Debug: mostrar todos los elementos con data-testid
      this.logger.log('Debugging: Looking for all data-testid elements...');
      try {
        const allDataTestIdElements = await page.$$eval(
          '[data-testid]',
          (elements) =>
            elements.map((el) => ({
              tagName: el.tagName,
              dataTestId: el.getAttribute('data-testid'),
              text: el.textContent?.substring(0, 50),
            })),
        );
        this.logger.log(
          'Found data-testid elements:',
          JSON.stringify(allDataTestIdElements, null, 2),
        );
      } catch (error) {
        this.logger.warn('Debug data-testid query failed:', error.message);
      }

      // Debug: mostrar todos los elementos con name
      this.logger.log('Debugging: Looking for all name elements...');
      try {
        const allDataNameElements = await page.$$eval('[name]', (elements) =>
          elements.map((el) => ({
            tagName: el.tagName,
            dataName: el.getAttribute('name'),
            text: el.textContent?.substring(0, 50),
          })),
        );
        this.logger.log(
          'Found name elements:',
          JSON.stringify(allDataNameElements, null, 2),
        );
      } catch (error) {
        this.logger.warn('Debug query failed:', error.message);
      }

      throw new Error('Start element not found with any selector');
    }

    this.logger.log('Start element found!');
  }

  private async startRecording(
    page: Page,
    outputPath: string,
  ): Promise<string> {
    this.logger.log('Recording started automatically with page creation');

    // Generate a temporary webm path
    const webmPath = outputPath.replace('.mp4', '.webm');
    return webmPath;
  }

  private async waitForFinishElement(page: Page): Promise<void> {
    this.logger.log('Waiting for end-quizz element...');

    // Intentar múltiples selectores posibles para el elemento de finalización
    const selectors = [
      '[data-testid="end-quizz"]',
      '[data-testid="end-quiz"]',
      'span[data-testid="end-quizz"]',
      'button[data-testid="end-quizz"]',
      '*[name*="end"]',
    ];

    let elementFound = false;
    const maxAttempts = 150; // 150 intentos = 5 minutos (2 segundos por intento)
    let attempts = 0;

    // Polling mechanism: verificar cada 2 segundos
    while (!elementFound && attempts < maxAttempts) {
      attempts++;
      this.logger.log(
        `Checking for finish element - attempt ${attempts}/${maxAttempts}`,
      );

      for (const selector of selectors) {
        try {
          const element = await page.$(selector);
          if (element) {
            this.logger.log(`Finish element found with selector: ${selector}`);
            this.logger.log('Waiting 6 seconds before stopping...');
            await this.sleep(6000);
            elementFound = true;
            break;
          }
        } catch (error) {
          // Continuar con el siguiente selector
        }
      }

      if (!elementFound) {
        // Verificar con búsqueda de texto como fallback
        try {
          const textElement = await page.$('text=/end|finish|finalizar/i');
          if (textElement) {
            this.logger.log('Found finish element with text search');
            this.logger.log('Waiting 6 seconds before stopping...');
            await this.sleep(6000);
            elementFound = true;
          }
        } catch (error) {
          // Continuar
        }
      }

      if (!elementFound) {
        await this.sleep(2000); // Esperar 2 segundos antes del siguiente intento
      }
    }

    if (!elementFound) {
      // Debug: mostrar todos los elementos con data-testid para depuración
      this.logger.log(
        'Debugging: Looking for all data-testid elements at finish...',
      );
      try {
        const allDataTestIdElements = await page.$$eval(
          '[data-testid]',
          (elements) =>
            elements.map((el) => ({
              tagName: el.tagName,
              dataTestId: el.getAttribute('data-testid'),
              text: el.textContent?.substring(0, 50),
            })),
        );
        this.logger.log(
          'Found data-testid elements at finish:',
          JSON.stringify(allDataTestIdElements, null, 2),
        );
      } catch (error) {
        this.logger.warn('Debug data-testid query failed:', error.message);
      }

      // También buscar elementos con name
      this.logger.log('Debugging: Looking for all name elements at finish...');
      try {
        const allDataNameElements = await page.$$eval('[name]', (elements) =>
          elements.map((el) => ({
            tagName: el.tagName,
            dataName: el.getAttribute('name'),
            text: el.textContent?.substring(0, 50),
          })),
        );
        this.logger.log(
          'Found name elements at finish:',
          JSON.stringify(allDataNameElements, null, 2),
        );
      } catch (error) {
        this.logger.warn('Debug finish query failed:', error.message);
      }

      this.logger.warn(
        'Finish element not found with any selector, continuing anyway...',
      );
    }
  }

  private async stopRecording(page: Page): Promise<void> {
    this.logger.log('Stopping recording...');

    // Cerrar el contexto para finalizar la grabación de Playwright
    if (page) {
      try {
        const context = page.context();
        await page.close();
        await context.close();
        this.logger.log('Recording stopped - page and context closed');
      } catch (e) {
        this.logger.warn('Error stopping recording:', e);
      }
    }
  }

  private async convertToMp4(
    webmPath: string,
    outputPath: string,
  ): Promise<void> {
    this.logger.log('Converting webm to mp4...');

    // Get the actual video path from Playwright
    const videoPath = await this.getVideoPath();

    if (videoPath && fs.existsSync(videoPath)) {
      // Usar el método optimizado para 1080x1920
      try {
        await this.ffmpegConverter.convertMobileVertical1080x1920(
          videoPath,
          outputPath,
        );
        this.logger.log('Mobile vertical conversion completed successfully');
      } catch (error) {
        this.logger.warn(
          'Mobile vertical conversion failed, trying fallback:',
          error,
        );
        try {
          await this.ffmpegConverter.convertWebmToMp4(videoPath, outputPath);
        } catch (fallbackError) {
          this.logger.error('All conversion methods failed:', fallbackError);
          throw fallbackError;
        }
      }

      // Clean up temporary webm file
      try {
        fs.unlinkSync(videoPath);
        // También limpiar el directorio si está vacío
        const videoDir = path.dirname(videoPath);
        const remainingFiles = fs.readdirSync(videoDir);
        if (remainingFiles.length === 0) {
          fs.rmdirSync(videoDir);
        }
      } catch (error) {
        this.logger.warn('Could not delete temporary webm file:', error);
      }
    } else {
      throw new Error('Video file was not created by Playwright');
    }
  }

  private async getVideoPath(): Promise<string | null> {
    const videoDir = '/tmp/playwright-videos';

    // Esperar hasta 15 segundos para que aparezca el archivo
    for (let attempt = 0; attempt < 15; attempt++) {
      if (!fs.existsSync(videoDir)) {
        await this.sleep(1000);
        continue;
      }

      const files = fs.readdirSync(videoDir);
      const webmFiles = files.filter((file) => file.endsWith('.webm'));

      if (webmFiles.length === 0) {
        await this.sleep(1000);
        continue;
      }

      // Get the most recent webm file
      const latestFile = webmFiles
        .map((file) => ({
          name: file,
          path: path.join(videoDir, file),
          mtime: fs.statSync(path.join(videoDir, file)).mtime,
        }))
        .sort((a, b) => b.mtime.getTime() - a.mtime.getTime())[0];

      // Verificar que el archivo no esté siendo escrito (tamaño estable)
      const initialSize = fs.statSync(latestFile.path).size;
      await this.sleep(2000); // Esperar más tiempo para asegurar estabilidad

      try {
        const finalSize = fs.statSync(latestFile.path).size;
        if (initialSize === finalSize && finalSize > 0) {
          this.logger.log(
            `Found video file: ${latestFile.path} (${finalSize} bytes)`,
          );

          // Verificar una vez más después de 1 segundo adicional
          await this.sleep(1000);
          const verificationSize = fs.statSync(latestFile.path).size;
          if (verificationSize === finalSize) {
            this.logger.log(
              `Video file verified as complete: ${finalSize} bytes`,
            );
            return latestFile.path;
          }
        }
      } catch (error) {
        this.logger.warn('Error checking file size:', error);
      }
    }

    return null;
  }

  private async closeBrowser(
    browser: Browser | null,
    page: Page | null,
  ): Promise<void> {
    if (page) {
      try {
        // Verificar si la página y contexto aún están activos
        if (!page.isClosed()) {
          const context = page.context();
          await page.close();
          await context.close();
          this.logger.log('Page and context closed in closeBrowser');
        }
      } catch (e) {
        this.logger.warn('Error closing page/context:', e);
      }
    }
    if (browser) {
      try {
        await browser.close();
        this.logger.log('Browser closed');
      } catch (e) {
        this.logger.warn('Error closing browser:', e);
      }
    }
  }

  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}
