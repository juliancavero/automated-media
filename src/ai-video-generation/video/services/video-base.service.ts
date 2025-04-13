import { Injectable, Logger } from '@nestjs/common';
import { VideoOptions } from '../interfaces/video-options.interface';
import { VideoGeneratorService } from './video-generator.service';
import { FileOperationsService } from './file-operations.service';
import { AudioService } from './audio.service';
import * as path from 'path';

@Injectable()
export class VideoBaseService {
  private readonly logger = new Logger(VideoBaseService.name);
  private readonly DEFAULT_VIDEO_OPTIONS: VideoOptions = {
    duration: 5,
    format: 'mp4',
  };

  constructor(
    private readonly videoGeneratorService: VideoGeneratorService,
    private readonly fileOperationsService: FileOperationsService,
    private readonly audioService: AudioService,
  ) {}

  /**
   * Creates a video from a list of image URLs using audio files from the /public/audios folder
   * @param imagenes List of image URLs
   * @param options Video configuration options
   * @returns Object with path to the generated video file
   */
  async crearVideo(
    imagenes: string[],
    options?: VideoOptions,
  ): Promise<{ path: string; relativePath: string }> {
    const videoOptions = { ...this.DEFAULT_VIDEO_OPTIONS, ...options };
    const { tempDir, imageDir, videoPath, audiosDir, videosDir } =
      this.fileOperationsService.createDirectories();

    const downloadedImages: string[] = [];
    let audioFiles: string[] = [];

    try {
      // Get audio files from the /public/audios folder
      audioFiles = this.audioService.getAudioFilesFromDirectory(audiosDir);
      this.logger.log(`Audio files found: ${audioFiles.length}`);

      // Download all images
      await Promise.all(
        imagenes.map(async (imageUrl, index) => {
          const imageName = `image${index + 1}.jpg`;
          const imagePath = `${imageDir}/${imageName}`;
          await this.fileOperationsService.downloadImage(imageUrl, imagePath);
          downloadedImages.push(imagePath);
        }),
      );

      // Generate the video
      await this.videoGeneratorService.generateVideo(
        downloadedImages,
        audioFiles,
        videoPath,
        tempDir,
        videoOptions,
      );

      // Generate a filename for the public video
      const filename = `video_${Date.now()}.${videoOptions.format}`;

      // Save the video to the public directory
      const publicVideoPath = this.fileOperationsService.saveVideoToPublic(
        videoPath,
        filename,
        videosDir,
      );

      // Calculate relative path for URL
      const relativePath = path.join('/videos', filename);

      // Clean up temporary files
      this.fileOperationsService.cleanTempFiles(
        [...downloadedImages, videoPath],
        imageDir,
      );

      return {
        path: publicVideoPath,
        relativePath,
      };
    } catch (error) {
      this.logger.error('Error creating video:', error);
      throw error;
    }
  }
}
