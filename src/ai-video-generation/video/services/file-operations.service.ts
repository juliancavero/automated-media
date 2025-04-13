import { Injectable, Logger } from '@nestjs/common';
import * as fs from 'fs';
import * as path from 'path';
import * as https from 'https';
import * as http from 'http';
import { URL } from 'url';
import { DirectoryPaths } from '../interfaces/directory-paths.interface';
import { ensureDirectoryExists, safeRemove } from 'src/utils/common.utils';

@Injectable()
export class FileOperationsService {
  private readonly logger = new Logger(FileOperationsService.name);

  /**
   * Creates all required directories for video processing
   * @returns DirectoryPaths object with all paths
   */
  createDirectories(): DirectoryPaths {
    const tempDir = path.join(process.cwd(), 'temp');
    const imageDir = path.join(tempDir, 'images', `job_${Date.now()}`);
    const videoPath = path.join(tempDir, `video_${Date.now()}.mp4`);
    const publicDir = path.join(process.cwd(), 'public');
    const audiosDir = path.join(publicDir, 'audios');
    const videosDir = path.join(publicDir, 'videos');

    // Create necessary directories
    ensureDirectoryExists(tempDir, this.logger);
    ensureDirectoryExists(imageDir, this.logger);
    ensureDirectoryExists(publicDir, this.logger);
    ensureDirectoryExists(audiosDir, this.logger);
    ensureDirectoryExists(videosDir, this.logger);

    return { tempDir, imageDir, videoPath, publicDir, audiosDir, videosDir };
  }

  /**
   * Downloads an image from a URL and saves it to the file system
   */
  async downloadImage(imageUrl: string, imagePath: string): Promise<void> {
    return this.downloadFile(imageUrl, imagePath);
  }

  /**
   * Downloads a file from a URL and saves it to the file system
   */
  async downloadFile(fileUrl: string, filePath: string): Promise<void> {
    return new Promise((resolve, reject) => {
      const url = new URL(fileUrl);
      const protocol = url.protocol === 'https:' ? https : http;

      protocol
        .get(fileUrl, (response) => {
          if (response.statusCode !== 200) {
            reject(
              new Error(
                `Failed to download file. Status code: ${response.statusCode}`,
              ),
            );
            return;
          }

          const fileStream = fs.createWriteStream(filePath);
          response.pipe(fileStream);

          fileStream.on('finish', () => {
            fileStream.close();
            resolve();
          });
        })
        .on('error', (error) => {
          fs.unlink(filePath, () => reject(error));
        });
    });
  }

  /**
   * Reads a file and returns its contents as a buffer
   */
  readFileAsBuffer(filePath: string): Buffer {
    return fs.readFileSync(filePath);
  }

  /**
   * Saves a video to the public videos directory
   * @param tempVideoPath Path to the temporary video file
   * @param filename Name to save the file as (without directory)
   * @returns Full path to the saved video file
   */
  saveVideoToPublic(
    tempVideoPath: string,
    filename: string,
    videosDir: string,
  ): string {
    const publicVideoPath = path.join(videosDir, filename);

    // Copy the file from temp to public/videos (will overwrite if exists)
    fs.copyFileSync(tempVideoPath, publicVideoPath);
    this.logger.log(`Video saved to public directory: ${publicVideoPath}`);

    return publicVideoPath;
  }

  /**
   * Cleans up temporary files created during processing
   */
  cleanTempFiles(filePaths: string[], imageDir: string): void {
    try {
      // Delete each downloaded file
      for (const filePath of filePaths) {
        safeRemove(filePath, false, this.logger);
      }

      // Delete the image directory if it's empty
      if (fs.existsSync(imageDir) && fs.readdirSync(imageDir).length === 0) {
        safeRemove(imageDir, true, this.logger);
      }
    } catch (error) {
      this.logger.warn('Error cleaning temporary files:', error);
    }
  }
}
