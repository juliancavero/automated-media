import { Injectable, Logger } from '@nestjs/common';
import * as puppeteer from 'puppeteer';
import * as fs from 'fs';
import { FFmpegQuizzService } from './ffmpeg.quizz';

// Declare html2canvas for TypeScript
declare global {
  interface Window {
    html2canvas: any;
    mediaRecorder: MediaRecorder;
    recordedVideoBlob: Blob;
    chunksReceived: number;
  }
}

@Injectable()
export class PuppeteerService {
  private readonly logger = new Logger(PuppeteerService.name);

  constructor(private readonly ffmpegService: FFmpegQuizzService) {}

  async recordQuizVideo(
    url: string,
    outputPath: string = '/home/julian/Escritorio/personal/automated-media/public/videos/output.webm',
  ): Promise<string> {
    let browser: puppeteer.Browser | null = null;
    let page: puppeteer.Page | null = null;

    try {
      // Launch browser with necessary flags for video recording
      browser = await puppeteer.launch({
        headless: false,
        args: [
          '--enable-usermedia-screen-capturing',
          '--allow-http-screen-capture',
          '--auto-select-desktop-capture-source=Entire screen',
          '--use-fake-ui-for-media-stream',
          '--disable-web-security',
          '--allow-running-insecure-content',
          '--autoplay-policy=no-user-gesture-required',
          '--disable-features=VizDisplayCompositor',
        ],
      });

      page = await browser.newPage();

      // Set viewport for consistent recording
      await page.setViewport({ width: 720, height: 1280 });

      // Navigate to the quiz URL and wait for it to load
      await page.goto(url, { waitUntil: 'networkidle2' });

      // Start recording using a different approach - capture canvas stream without overlaying
      await page.evaluate(() => {
        return new Promise<void>((resolve, reject) => {
          console.log('Starting video recording...');

          // Create an offscreen canvas for recording
          const canvas = document.createElement('canvas');
          canvas.width = 720;
          canvas.height = 1280;

          const ctx = canvas.getContext('2d');
          if (!ctx) {
            reject(new Error('Failed to get canvas context'));
            return;
          }

          // Set white background
          ctx.fillStyle = '#ffffff';
          ctx.fillRect(0, 0, canvas.width, canvas.height);

          const stream = canvas.captureStream(30);
          console.log('Canvas stream created');

          const mediaRecorder = new MediaRecorder(stream, {
            mimeType: 'video/webm; codecs=vp8',
          });

          const chunks: Blob[] = [];
          let chunksReceived = 0;
          let isRecording = false;
          let recordingInterval: ReturnType<typeof setInterval>;

          mediaRecorder.ondataavailable = (event) => {
            console.log('Data available, size:', event.data.size);
            if (event.data.size > 0) {
              chunks.push(event.data);
              chunksReceived++;
              console.log('Chunk added, total chunks:', chunks.length);
            }
          };

          mediaRecorder.onstop = () => {
            console.log('Recording stopped, total chunks:', chunks.length);
            isRecording = false;
            if (recordingInterval) {
              clearInterval(recordingInterval);
            }
            const blob = new Blob(chunks, { type: 'video/webm' });
            console.log('Final blob size:', blob.size);
            window.recordedVideoBlob = blob;
            window.chunksReceived = chunksReceived;
          };

          mediaRecorder.onstart = () => {
            console.log('Recording started successfully');
            isRecording = true;

            // Load html2canvas and start capturing
            const script = document.createElement('script');
            script.src =
              'https://cdn.jsdelivr.net/npm/html2canvas@1.4.1/dist/html2canvas.min.js';
            script.onload = () => {
              console.log('html2canvas loaded');
              let frameCount = 0;

              const captureFrame = () => {
                if (!isRecording) return;

                // Try to find the main content area, fallback to body
                const targetElement =
                  document.querySelector('main') ||
                  document.querySelector('#root') ||
                  document.querySelector('.app') ||
                  document.body;

                window
                  .html2canvas(targetElement, {
                    useCORS: true,
                    allowTaint: true,
                    logging: true,
                    width: 720,
                    height: 1280,
                    backgroundColor: '#ffffff',
                    scale: 1,
                    removeContainer: true,
                    foreignObjectRendering: true,
                    ignoreElements: (element) => {
                      // Skip script tags and other non-visual elements
                      return (
                        element.tagName === 'SCRIPT' ||
                        element.tagName === 'STYLE' ||
                        element.style.display === 'none' ||
                        element.style.visibility === 'hidden'
                      );
                    },
                  })
                  .then((capturedCanvas) => {
                    console.log('Successfully captured frame:', frameCount);
                    // Draw the captured content to our recording canvas
                    ctx.clearRect(0, 0, canvas.width, canvas.height);
                    ctx.fillStyle = '#ffffff';
                    ctx.fillRect(0, 0, canvas.width, canvas.height);
                    ctx.drawImage(
                      capturedCanvas,
                      0,
                      0,
                      canvas.width,
                      canvas.height,
                    );
                    frameCount++;
                  })
                  .catch((error) => {
                    console.error('Frame capture error:', error);
                    console.log('Attempting fallback capture method...');

                    // Try a simpler capture approach
                    try {
                      window
                        .html2canvas(document.documentElement, {
                          useCORS: true,
                          allowTaint: true,
                          logging: false,
                          width: 720,
                          height: 1280,
                          backgroundColor: '#ffffff',
                          scale: 0.5,
                          x: 0,
                          y: 0,
                          scrollX: 0,
                          scrollY: 0,
                        })
                        .then((fallbackCanvas) => {
                          console.log('Fallback capture successful');
                          ctx.clearRect(0, 0, canvas.width, canvas.height);
                          ctx.fillStyle = '#ffffff';
                          ctx.fillRect(0, 0, canvas.width, canvas.height);
                          ctx.drawImage(
                            fallbackCanvas,
                            0,
                            0,
                            canvas.width,
                            canvas.height,
                          );
                          frameCount++;
                        })
                        .catch((fallbackError) => {
                          console.error(
                            'Fallback capture also failed:',
                            fallbackError,
                          );
                          // Only show error message if both methods fail
                          ctx.fillStyle = '#ffffff';
                          ctx.fillRect(0, 0, canvas.width, canvas.height);
                          ctx.fillStyle = '#333333';
                          ctx.font = '20px Arial';
                          ctx.textAlign = 'center';
                          ctx.fillText(
                            'Quiz Recording - Capture Error',
                            canvas.width / 2,
                            canvas.height / 2,
                          );
                          ctx.fillText(
                            'Frame: ' + frameCount,
                            canvas.width / 2,
                            canvas.height / 2 + 30,
                          );
                          frameCount++;
                        });
                    } catch (e) {
                      console.error('Complete capture failure:', e);
                      // Draw error content
                      ctx.fillStyle = '#ffffff';
                      ctx.fillRect(0, 0, canvas.width, canvas.height);
                      ctx.fillStyle = '#333333';
                      ctx.font = '20px Arial';
                      ctx.textAlign = 'center';
                      ctx.fillText(
                        'Quiz Recording - Error',
                        canvas.width / 2,
                        canvas.height / 2,
                      );
                      ctx.fillText(
                        'Frame: ' + frameCount,
                        canvas.width / 2,
                        canvas.height / 2 + 30,
                      );
                      frameCount++;
                    }
                  });
              };

              // Wait a bit for the page to fully render before starting capture
              setTimeout(() => {
                console.log('Starting frame capture...');
                // Capture frames at 10 FPS
                recordingInterval = setInterval(captureFrame, 100);
                // Capture first frame immediately
                captureFrame();
              }, 1000);
            };

            script.onerror = () => {
              console.error('Failed to load html2canvas');
              reject(new Error('Failed to load html2canvas library'));
            };

            document.head.appendChild(script);
          };

          mediaRecorder.onerror = (event) => {
            console.error('MediaRecorder error:', event);
            reject(new Error('MediaRecorder error'));
          };

          // Start recording
          mediaRecorder.start(500); // Request data every 500ms
          window.mediaRecorder = mediaRecorder;

          resolve();
        });
      });

      this.logger.log(
        'Recording setup completed, waiting for initialization...',
      );

      // Wait for recording to start
      await new Promise((resolve) => setTimeout(resolve, 2000));

      // Check if recording started
      const recordingStarted = await page.evaluate(() => {
        return window.mediaRecorder?.state === 'recording';
      });

      if (!recordingStarted) {
        throw new Error('Recording failed to start');
      }

      this.logger.log(
        'Recording confirmed started, capturing for 5 seconds...',
      );

      // Record for exactly 5 seconds
      await new Promise((resolve) => setTimeout(resolve, 5000));

      this.logger.log('5-second recording completed, stopping...');

      // Stop recording
      await page.evaluate(() => {
        const mediaRecorder = window.mediaRecorder;
        if (mediaRecorder && mediaRecorder.state === 'recording') {
          console.log('Stopping recording...');
          mediaRecorder.stop();
        }
      });

      // Wait for recording to finish
      this.logger.log('Waiting for recording to finish...');
      await new Promise((resolve) => setTimeout(resolve, 2000));

      // Check blob
      const blobInfo = await page.evaluate(() => {
        const blob = window.recordedVideoBlob;
        return {
          exists: !!blob,
          size: blob?.size || 0,
          type: blob?.type || 'unknown',
          chunksReceived: window.chunksReceived || 0,
        };
      });

      this.logger.log(`Blob info: ${JSON.stringify(blobInfo)}`);

      if (!blobInfo.exists || blobInfo.size === 0) {
        throw new Error(
          `No video data recorded - blob info: ${JSON.stringify(blobInfo)}`,
        );
      }

      // Get the recorded video blob
      const blobData = await page.evaluate(() => {
        return new Promise<string | null>((resolve) => {
          const blob = window.recordedVideoBlob;
          if (blob && blob.size > 0) {
            const reader = new FileReader();
            reader.onload = () => resolve(reader.result as string);
            reader.onerror = () => resolve(null);
            reader.readAsDataURL(blob);
          } else {
            resolve(null);
          }
        });
      });

      // Save video to disk
      if (blobData && blobData.startsWith('data:')) {
        const base64Data = blobData.split(',')[1];
        const buffer = Buffer.from(base64Data, 'base64');

        this.logger.log(`Final video buffer size: ${buffer.length} bytes`);

        // Ensure the directory exists
        const path = require('path');
        const dir = path.dirname(outputPath);
        if (!fs.existsSync(dir)) {
          fs.mkdirSync(dir, { recursive: true });
        }

        fs.writeFileSync(outputPath, buffer);
        this.logger.log(`Video saved to: ${outputPath}`);
      } else {
        throw new Error('Failed to convert video data to buffer');
      }

      return outputPath;
    } catch (error) {
      this.logger.error('Error recording quiz video:', error);
      throw error;
    } finally {
      if (page) await page.close();
      if (browser) await browser.close();
    }
  }

  async recordQuizById(
    quizId: string,
    baseUrl: string = 'http://localhost:5173',
  ): Promise<string> {
    const url = `${baseUrl}/quizz/${quizId}`;
    const outputPath = `/home/julian/Escritorio/personal/automated-media/public/videos/quiz_${quizId}_${Date.now()}.webm`;

    return await this.recordQuizVideo(url, outputPath);
  }

  async convertWebMToMP4(
    inputPath: string,
    outputPath: string = '/home/julian/Escritorio/personal/automated-media/public/videos/final.mp4',
  ): Promise<string> {
    return this.ffmpegService.convertWebMToMP4(inputPath, outputPath);
  }

  async recordAndConvertQuizVideo(
    url: string,
    webmPath: string = '/home/julian/Escritorio/personal/automated-media/public/videos/output.webm',
    mp4Path: string = '/home/julian/Escritorio/personal/automated-media/public/videos/final.mp4',
  ): Promise<{ webmPath: string; mp4Path: string }> {
    try {
      // First record the video
      const recordedWebmPath = await this.recordQuizVideo(url, webmPath);

      // Then convert to MP4
      const convertedMp4Path = await this.ffmpegService.convertWebMToMP4(
        recordedWebmPath,
        mp4Path,
      );

      return {
        webmPath: recordedWebmPath,
        mp4Path: convertedMp4Path,
      };
    } catch (error) {
      this.logger.error('Error in record and convert process:', error);
      throw error;
    }
  }

  async recordAndConvertQuizById(
    quizId: string,
    baseUrl: string = 'http://localhost:5173',
  ): Promise<{ webmPath: string; mp4Path: string }> {
    const url = `${baseUrl}/quizz/${quizId}`;
    const timestamp = Date.now();
    const webmPath = `/home/julian/Escritorio/personal/automated-media/public/videos/quiz_${quizId}_${timestamp}.webm`;
    const mp4Path = `/home/julian/Escritorio/personal/automated-media/public/videos/quiz_${quizId}_${timestamp}.mp4`;

    return await this.recordAndConvertQuizVideo(url, webmPath, mp4Path);
  }
}
