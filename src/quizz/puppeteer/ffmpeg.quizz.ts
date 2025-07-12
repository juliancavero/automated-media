import { Injectable, Logger } from '@nestjs/common';
import * as fs from 'fs';
import * as path from 'path';
import { spawn, ChildProcess } from 'child_process';

const ffmpegInstaller = require('@ffmpeg-installer/ffmpeg');
const ffmpegPath = ffmpegInstaller.path;

@Injectable()
export class FFmpegQuizzService {
  private readonly logger = new Logger(FFmpegQuizzService.name);
  private ffmpegProcess: ChildProcess | null = null;

  async startHighQualityRecording(
    outputPath: string,
    x?: number,
    y?: number,
    width?: number,
    height?: number,
  ): Promise<void> {
    // Check X11 display first
    const x11Available = await this.checkX11Display();
    if (!x11Available) {
      throw new Error('X11 display not available for screen recording');
    }

    // Try to find browser window automatically
    let recordingArea = { x: 100, y: 50, width: 600, height: 800 }; // Smaller defaults

    if (!x || !y || !width || !height) {
      this.logger.log('Attempting to detect browser window...');
      const browserWindow = await this.findBrowserWindow();

      if (browserWindow) {
        recordingArea = {
          x: browserWindow.x,
          y: browserWindow.y,
          width: browserWindow.width,
          height: browserWindow.height,
        };
        this.logger.log(
          `Using detected browser window: ${recordingArea.width}x${recordingArea.height} at (${recordingArea.x}, ${recordingArea.y})`,
        );
      } else {
        this.logger.warn('Could not detect browser window, using defaults');
      }
    } else {
      recordingArea = { x, y, width, height };
    }

    return new Promise((resolve, reject) => {
      // Ensure output directory exists
      const dir = path.dirname(outputPath);
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
        this.logger.log(`Created directory: ${dir}`);
      }

      this.logger.log(`Starting high quality recording: ${outputPath}`);
      this.logger.log(
        `Recording area: ${recordingArea.width}x${recordingArea.height} at position ${recordingArea.x},${recordingArea.y}`,
      );

      // High quality MP4 recording arguments with better error handling
      const args = [
        '-f',
        'x11grab',
        '-video_size',
        `${recordingArea.width}x${recordingArea.height}`,
        '-framerate',
        '30', // Reduced to 30fps for stability
        '-i',
        `:0.0+${recordingArea.x},${recordingArea.y}`,
        '-c:v',
        'libx264',
        '-preset',
        'ultrafast', // Faster encoding for real-time
        '-crf',
        '23', // Good quality balance
        '-pix_fmt',
        'yuv420p',
        '-movflags',
        '+faststart',
        '-avoid_negative_ts',
        'make_zero', // Handle timing issues
        '-fflags',
        '+genpts', // Generate presentation timestamps
        '-y', // Overwrite output file
        outputPath,
      ];

      this.logger.log(`FFmpeg command: ${ffmpegPath} ${args.join(' ')}`);

      this.ffmpegProcess = spawn(ffmpegPath, args, {
        stdio: ['pipe', 'pipe', 'pipe'],
      });

      this.ffmpegProcess.stdout?.on('data', (data) => {
        this.logger.debug(`FFmpeg stdout: ${data.toString().trim()}`);
      });

      this.ffmpegProcess.stderr?.on('data', (data) => {
        const output = data.toString();
        this.logger.debug(`FFmpeg stderr: ${output.trim()}`);

        // Log important messages
        if (output.includes('frame=') || output.includes('time=')) {
          this.logger.log(`Recording progress: ${output.trim()}`);
        }
        if (output.includes('error') || output.includes('Error')) {
          this.logger.error(`FFmpeg error output: ${output.trim()}`);
        }
      });

      this.ffmpegProcess.on('error', (error) => {
        this.logger.error('FFmpeg spawn error:', error);
        reject(error);
      });

      this.ffmpegProcess.on('exit', (code, signal) => {
        this.logger.log(
          `FFmpeg process exited with code: ${code}, signal: ${signal}`,
        );
      });

      // Give FFmpeg more time to start and verify it's working
      setTimeout(() => {
        if (this.ffmpegProcess && !this.ffmpegProcess.killed) {
          this.logger.log('High quality recording started successfully');
          resolve();
        } else {
          reject(new Error('FFmpeg failed to start'));
        }
      }, 3000); // Increased timeout to 3 seconds
    });
  }

  async stopRecording(): Promise<void> {
    return new Promise((resolve) => {
      if (this.ffmpegProcess && !this.ffmpegProcess.killed) {
        this.logger.log('Stopping recording gracefully...');

        let resolved = false;

        // Set up exit handler before sending quit signal
        this.ffmpegProcess.on('exit', (code, signal) => {
          if (!resolved) {
            this.logger.log(
              `Recording stopped with exit code: ${code}, signal: ${signal}`,
            );
            this.ffmpegProcess = null;
            resolved = true;
            resolve();
          }
        });

        // Send 'q' to quit FFmpeg gracefully
        try {
          if (this.ffmpegProcess.stdin) {
            this.ffmpegProcess.stdin.write('q\n');
            this.ffmpegProcess.stdin.end();
          }
        } catch (error) {
          this.logger.warn('Could not send quit signal:', error);
          // Try SIGTERM instead
          this.ffmpegProcess.kill('SIGTERM');
        }

        // Backup kill after 8 seconds
        setTimeout(() => {
          if (this.ffmpegProcess && !this.ffmpegProcess.killed && !resolved) {
            this.logger.warn('Force killing FFmpeg process');
            this.ffmpegProcess.kill('SIGKILL');
            this.ffmpegProcess = null;
            resolved = true;
            resolve();
          }
        }, 8000);

        // Extra backup after 12 seconds
        setTimeout(() => {
          if (!resolved) {
            this.logger.warn('Final timeout reached, resolving anyway');
            this.ffmpegProcess = null;
            resolved = true;
            resolve();
          }
        }, 12000);
      } else {
        this.logger.log('No recording process to stop');
        resolve();
      }
    });
  }

  isRecording(): boolean {
    return this.ffmpegProcess !== null && !this.ffmpegProcess.killed;
  }

  async checkX11Display(): Promise<boolean> {
    return new Promise((resolve) => {
      const spawn = require('child_process').spawn;
      const xdpyinfo = spawn('xdpyinfo', ['-display', ':0.0']);

      xdpyinfo.on('exit', (code) => {
        if (code === 0) {
          this.logger.log('X11 display is available');
          resolve(true);
        } else {
          this.logger.error('X11 display not available');
          resolve(false);
        }
      });

      xdpyinfo.on('error', (error) => {
        this.logger.error('Failed to check X11 display:', error);
        resolve(false);
      });

      // Timeout after 3 seconds
      setTimeout(() => {
        xdpyinfo.kill();
        resolve(false);
      }, 3000);
    });
  }

  async findBrowserWindow(): Promise<{
    x: number;
    y: number;
    width: number;
    height: number;
  } | null> {
    return new Promise((resolve) => {
      // Try to find Chromium window first, then Chrome
      const windowNames = ['Chromium', 'Chrome', 'Google Chrome'];

      const tryWindowName = (index: number) => {
        if (index >= windowNames.length) {
          resolve(null);
          return;
        }

        const windowName = windowNames[index];
        const xwininfo = spawn('xwininfo', ['-name', windowName]);
        let output = '';

        xwininfo.stdout?.on('data', (data) => {
          output += data.toString();
        });

        xwininfo.on('close', (code) => {
          if (code === 0) {
            // Parse the output to get window position and size
            const xRegex = /Absolute upper-left X:\s*(\d+)/;
            const yRegex = /Absolute upper-left Y:\s*(\d+)/;
            const widthRegex = /Width:\s*(\d+)/;
            const heightRegex = /Height:\s*(\d+)/;

            const xMatch = xRegex.exec(output);
            const yMatch = yRegex.exec(output);
            const widthMatch = widthRegex.exec(output);
            const heightMatch = heightRegex.exec(output);

            if (xMatch && yMatch && widthMatch && heightMatch) {
              // Get raw window dimensions
              const rawX = parseInt(xMatch[1]);
              const rawY = parseInt(yMatch[1]);
              const rawWidth = parseInt(widthMatch[1]);
              const rawHeight = parseInt(heightMatch[1]);

              // Adjust to exclude window decorations (title bar, borders)
              const titleBarHeight = 35; // Typical title bar height
              const borderWidth = 1; // Typical border width

              const windowInfo = {
                x: rawX + borderWidth,
                y: rawY + titleBarHeight,
                width: rawWidth - borderWidth * 2,
                height: rawHeight - titleBarHeight - borderWidth,
              };

              this.logger.log(
                `Found ${windowName} window: ${windowInfo.width}x${windowInfo.height} at (${windowInfo.x}, ${windowInfo.y}) [content area only]`,
              );
              resolve(windowInfo);
            } else {
              tryWindowName(index + 1);
            }
          } else {
            tryWindowName(index + 1);
          }
        });

        xwininfo.on('error', () => {
          tryWindowName(index + 1);
        });

        // Timeout for this attempt
        setTimeout(() => {
          xwininfo.kill();
          tryWindowName(index + 1);
        }, 3000);
      };

      tryWindowName(0);
    });
  }
}
