import { Injectable, Logger } from '@nestjs/common';
import * as fs from 'fs';
import * as path from 'path';

const ffmpegInstaller = require('@ffmpeg-installer/ffmpeg');
const ffprobeInstaller = require('@ffprobe-installer/ffprobe');
const ffmpegPath = ffmpegInstaller.path;
const ffprobePath = ffprobeInstaller.path;

const ffmpeg = require('fluent-ffmpeg');
ffmpeg.setFfmpegPath(ffmpegPath);
ffmpeg.setFfprobePath(ffprobePath);

@Injectable()
export class AudioService {
  private readonly logger = new Logger(AudioService.name);

  /**
   * Gets .mp3 audio files from a directory
   * @param directory Directory to search for audio files
   * @returns Array of audio file paths
   */
  getAudioFilesFromDirectory(directory: string): string[] {
    try {
      if (!fs.existsSync(directory)) {
        this.logger.warn(`Directory ${directory} does not exist`);
        return [];
      }

      // Read all files in the directory
      const files = fs.readdirSync(directory);

      // Filter only .mp3 files
      const audioFiles = files
        .filter((file) => file.toLowerCase().endsWith('.mp3'))
        .map((file) => path.join(directory, file));

      if (audioFiles.length === 0) {
        this.logger.warn(`No .mp3 files found in ${directory}`);
      }

      return audioFiles;
    } catch (error) {
      this.logger.error(`Error reading audio directory: ${error.message}`);
      return [];
    }
  }

  /**
   * Gets the duration of an audio file in seconds
   */
  async getAudioDuration(
    audioPath: string,
    defaultDuration: number,
  ): Promise<number> {
    try {
      return new Promise((resolve, reject) => {
        ffmpeg.ffprobe(audioPath, (err, metadata) => {
          if (err) {
            this.logger.error(
              `Error getting duration with ffprobe: ${err.message}`,
            );
            resolve(defaultDuration); // Use default duration in case of error
          } else {
            const duration = metadata.format.duration;
            resolve(duration);
          }
        });
      });
    } catch (error) {
      this.logger.error(`Error getting audio duration: ${error.message}`);
      return defaultDuration; // Use default duration in case of error
    }
  }
}
