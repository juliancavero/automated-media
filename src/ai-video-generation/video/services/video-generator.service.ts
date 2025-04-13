import { Injectable, Logger } from '@nestjs/common';
import * as fs from 'fs';
import * as path from 'path';
import { VideoOptions } from '../interfaces/video-options.interface';
import { AudioService } from './audio.service';

const ffmpegInstaller = require('@ffmpeg-installer/ffmpeg');
const ffprobeInstaller = require('@ffprobe-installer/ffprobe');
const ffmpegPath = ffmpegInstaller.path;
const ffprobePath = ffprobeInstaller.path;

const ffmpeg = require('fluent-ffmpeg');
ffmpeg.setFfmpegPath(ffmpegPath);
ffmpeg.setFfprobePath(ffprobePath);

@Injectable()
export class VideoGeneratorService {
  private readonly logger = new Logger(VideoGeneratorService.name);

  constructor(private readonly audioService: AudioService) {}

  /**
   * Generates a video from images using ffmpeg, synchronizing each image with its corresponding audio
   */
  async generateVideo(
    imagePaths: string[],
    audioPaths: string[],
    videoPath: string,
    tempDir: string,
    options: VideoOptions,
  ): Promise<void> {
    if (audioPaths.length === 0) {
      // If there are no audios, use the original method with fixed duration per image
      return this.generateVideoWithFixedDuration(
        imagePaths,
        [],
        videoPath,
        tempDir,
        options,
      );
    }

    // Create temporary directory for segments
    const segmentsDir = path.join(tempDir, 'segments');
    if (!fs.existsSync(segmentsDir)) {
      fs.mkdirSync(segmentsDir, { recursive: true });
    }

    try {
      const segments: { input: string; duration: number }[] = [];
      const segmentFilePaths: string[] = [];

      // For each audio, create a video segment with its corresponding image
      for (let i = 0; i < audioPaths.length; i++) {
        // Use the last available image if there aren't enough images
        const imageIndex = Math.min(i, imagePaths.length - 1);
        const imagePath = imagePaths[imageIndex];
        const audioPath = audioPaths[i];

        // Get audio duration
        const audioDuration = await this.audioService.getAudioDuration(
          audioPath,
          options.duration,
        );

        // Create video segment
        const segmentPath = path.join(segmentsDir, `segment_${i}.mp4`);
        await this.createVideoSegment(
          imagePath,
          audioPath,
          segmentPath,
          audioDuration,
        );

        segments.push({
          input: segmentPath,
          duration: audioDuration,
        });
        segmentFilePaths.push(segmentPath);
      }

      // Concatenate all segments into a single video
      await this.concatenateSegments(
        segmentFilePaths,
        videoPath,
        options.format,
      );

      // Clean up temporary files
      for (const segmentPath of segmentFilePaths) {
        if (fs.existsSync(segmentPath)) {
          fs.unlinkSync(segmentPath);
        }
      }
      if (fs.existsSync(segmentsDir)) {
        // Use fs.rm instead of fs.rmdir
        fs.rmSync(segmentsDir, { recursive: true, force: true });
      }
    } catch (error) {
      this.logger.error(`Error generating video: ${error.message}`);
      throw error;
    }
  }

  /**
   * Creates a video segment with an image and audio
   */
  private async createVideoSegment(
    imagePath: string,
    audioPath: string,
    outputPath: string,
    duration: number,
  ): Promise<void> {
    return new Promise((resolve, reject) => {
      ffmpeg()
        .input(imagePath)
        .inputOptions(['-loop 1', `-t ${duration}`])
        .input(audioPath)
        .outputOptions([
          '-c:v libx264',
          '-pix_fmt yuv420p',
          '-c:a aac',
          '-b:a 192k',
          '-shortest',
          `-t ${duration}`,
          '-map 0:v:0',
          '-map 1:a:0',
        ])
        .on('start', (commandLine) => {
          this.logger.log(`FFmpeg segment started: ${commandLine}`);
        })
        .on('error', (err) => {
          this.logger.error(`Error in FFmpeg segment: ${err.message}`);
          reject(err);
        })
        .on('end', () => {
          this.logger.log(`Segment created successfully: ${outputPath}`);
          resolve();
        })
        .output(outputPath)
        .run();
    });
  }

  /**
   * Concatenates multiple video segments into one
   */
  private async concatenateSegments(
    segmentPaths: string[],
    outputPath: string,
    format: string = 'mp4',
  ): Promise<void> {
    return new Promise((resolve, reject) => {
      // Verify if we have segments to concatenate
      if (segmentPaths.length === 0) {
        reject(new Error('No segments to concatenate'));
        return;
      }

      // Check if segments exist
      for (const segmentPath of segmentPaths) {
        if (!fs.existsSync(segmentPath)) {
          reject(new Error(`Segment file not found: ${segmentPath}`));
          return;
        }
      }

      const command = ffmpeg();

      // Create a concatenation list for ffmpeg
      const concatList = segmentPaths.map((p) => `file '${p}'`).join('\n');
      const concatFilePath = path.join(
        path.dirname(segmentPaths[0]),
        'concat_list.txt',
      );
      fs.writeFileSync(concatFilePath, concatList);

      command
        .input(concatFilePath)
        .inputOptions(['-f concat', '-safe 0'])
        .outputOptions([
          '-c:v copy',
          '-c:a aac',
          '-b:a 192k',
          '-movflags +faststart',
        ])
        .on('start', (commandLine) => {
          this.logger.log(`FFmpeg concatenation started: ${commandLine}`);
        })
        .on('error', (err) => {
          this.logger.error(`Error in FFmpeg concatenation: ${err.message}`);
          if (fs.existsSync(concatFilePath)) {
            fs.unlinkSync(concatFilePath);
          }
          reject(err);
        })
        .on('end', () => {
          this.logger.log(`Video concatenated successfully: ${outputPath}`);
          if (fs.existsSync(concatFilePath)) {
            fs.unlinkSync(concatFilePath);
          }

          // Verify the output file has audio
          this.verifyVideoHasAudio(outputPath)
            .then((hasAudio) => {
              if (!hasAudio) {
                this.logger.warn(
                  'The generated video has no audio or the audio stream is corrupted',
                );
              }
              resolve();
            })
            .catch((error) => {
              this.logger.error(`Error verifying audio: ${error.message}`);
              resolve(); // Still resolve to continue the process
            });
        })
        .output(outputPath)
        .run();
    });
  }

  /**
   * Verifies if a video file has audio
   */
  private async verifyVideoHasAudio(videoPath: string): Promise<boolean> {
    return new Promise((resolve) => {
      ffmpeg.ffprobe(videoPath, (err, metadata) => {
        if (err) {
          this.logger.error(`Error verifying audio: ${err.message}`);
          resolve(false);
          return;
        }

        // Check if the video has audio streams
        const hasAudio = metadata.streams.some(
          (stream) => stream.codec_type === 'audio',
        );
        if (!hasAudio) {
          this.logger.warn('No audio streams found in the generated video');
        } else {
          this.logger.log('Video generated with audio successfully');
        }

        resolve(hasAudio);
      });
    });
  }

  /**
   * Original method to generate video with fixed duration per image (without audio synchronization)
   */
  private async generateVideoWithFixedDuration(
    imagePaths: string[],
    audioPaths: string[],
    videoPath: string,
    publicDir: string,
    options: VideoOptions,
  ): Promise<void> {
    return new Promise((resolve, reject) => {
      const command = ffmpeg();

      // Configure each image as input
      imagePaths.forEach((imagePath) => {
        command.input(imagePath).loop(options.duration);
      });

      // If there are audios, add them to the command
      if (audioPaths.length > 0) {
        // Add all audios as inputs
        audioPaths.forEach((audioPath) => {
          command.input(audioPath);
        });

        // Prepare complex filter to mix images and audios
        let complexFilter = '';

        // Create a filter to concatenate the images
        const imageInputs = imagePaths.map((_, i) => `[${i}:v]`).join('');
        complexFilter += `${imageInputs}concat=n=${imagePaths.length}:v=1:a=0[vout];`;

        // Create a filter to concatenate the audios (if there's more than one)
        if (audioPaths.length > 1) {
          const audioInputs = audioPaths
            .map((_, i) => `[${imagePaths.length + i}:a]`)
            .join('');
          complexFilter += `${audioInputs}concat=n=${audioPaths.length}:v=0:a=1[aout]`;
        }

        command.complexFilter(complexFilter);

        // Map the outputs
        command.map('[vout]');
        if (audioPaths.length > 1) {
          command.map('[aout]');
        } else if (audioPaths.length === 1) {
          command.map(`[${imagePaths.length}:a]`);
        }
      }

      command
        .outputOptions([
          '-c:v libx264',
          '-pix_fmt yuv420p',
          '-c:a aac',
          '-b:a 192k',
          '-shortest',
        ])
        .on('start', (commandLine) => {
          this.logger.log(`FFmpeg process started: ${commandLine}`);
        })
        .on('progress', (progress) => {
          this.logger.debug(`FFmpeg progress: ${JSON.stringify(progress)}`);
        })
        .on('error', (err) => {
          this.logger.error('Error in FFmpeg: ' + err.message);
          reject(err);
        })
        .on('end', () => {
          this.logger.log(`Video generated successfully at: ${videoPath}`);

          // Verify the output file has audio
          this.verifyVideoHasAudio(videoPath)
            .then((hasAudio) => {
              if (!hasAudio && audioPaths.length > 0) {
                this.logger.warn(
                  'The generated video has no audio or the audio stream is corrupted',
                );
              }
              resolve();
            })
            .catch(() => {
              resolve(); // Still resolve to continue the process
            });
        })
        .output(videoPath)
        .format(options.format)
        .run();
    });
  }
}
