import { Injectable, Logger } from '@nestjs/common';
import * as fs from 'fs';
const ffmpegInstaller = require('@ffmpeg-installer/ffmpeg');
const ffprobeInstaller = require('@ffprobe-installer/ffprobe');
const ffmpegPath = ffmpegInstaller.path;
const ffprobePath = ffprobeInstaller.path;

const ffmpeg = require('fluent-ffmpeg');
ffmpeg.setFfmpegPath(ffmpegPath);
ffmpeg.setFfprobePath(ffprobePath);

@Injectable()
export class FFmpegQuizzService {
  private readonly logger = new Logger(FFmpegQuizzService.name);

  async convertWebMToMP4(
    inputPath: string,
    outputPath: string = '/home/julian/Escritorio/personal/automated-media/public/videos/final.mp4',
  ): Promise<string> {
    return new Promise((resolve, reject) => {
      // Check if input file exists
      if (!fs.existsSync(inputPath)) {
        reject(new Error(`Input file not found: ${inputPath}`));
        return;
      }

      this.logger.log(`Converting WebM to MP4: ${inputPath} -> ${outputPath}`);

      // Ensure the directory exists
      const path = require('path');
      const dir = path.dirname(outputPath);
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
        this.logger.log(`Created directory: ${dir}`);
      }

      ffmpeg()
        .input(inputPath)
        .outputOptions([
          '-r',
          '30', // Frame rate 30fps
          '-c:v',
          'libx264', // Video codec
          '-pix_fmt',
          'yuv420p', // Pixel format for browser compatibility
          '-c:a',
          'aac', // Audio codec
          '-b:a',
          '128k', // Audio bitrate
          '-movflags',
          '+faststart', // Optimize for web streaming
          '-y', // Overwrite output file
        ])
        .output(outputPath)
        .on('start', (commandLine) => {
          this.logger.log(`FFmpeg command: ${commandLine}`);
        })
        .on('progress', (progress) => {
          this.logger.log(`Processing: ${progress.percent}% done`);
        })
        .on('end', () => {
          if (fs.existsSync(outputPath)) {
            this.logger.log(`Video conversion completed: ${outputPath}`);
            resolve(outputPath);
          } else {
            reject(new Error('Output file was not created'));
          }
        })
        .on('error', (err: Error) => {
          this.logger.error('FFmpeg conversion error:', err.message);
          reject(new Error(`FFmpeg conversion failed: ${err.message}`));
        })
        .run();
    });
  }
}
