import { Injectable, Logger } from '@nestjs/common';
import {
  GoogleAIFileManager,
  FileState,
  FileMetadataResponse,
} from '@google/generative-ai/server';

@Injectable()
export class GoogleAIUploadService {
  private readonly logger = new Logger(GoogleAIUploadService.name);
  private readonly fileManager: GoogleAIFileManager;

  constructor() {
    this.fileManager = new GoogleAIFileManager(
      process.env.GOOGLE_AI_API_KEY || '',
    );
  }

  async uploadVideoFromUrl(url: string): Promise<FileMetadataResponse> {
    this.logger.log(`Uploading video from URL: ${url}`);

    try {
      const response = await fetch(url);
      const buffer = await response.arrayBuffer();
      const videoBuffer = Buffer.from(buffer);

      const uploadResponse = await this.fileManager.uploadFile(videoBuffer, {
        mimeType: 'video/mp4', // Assuming the video is in MP4 format. Adjust if necessary.
      });

      const fileName = uploadResponse.file.name;

      // Poll getFile() on a set interval to check file state.
      let file = await this.fileManager.getFile(fileName);
      while (file.state === FileState.PROCESSING) {
        process.stdout.write('.');
        // Sleep for 10 seconds
        await new Promise((resolve) => setTimeout(resolve, 10_000));
        // Fetch the file from the API again
        file = await this.fileManager.getFile(fileName);
      }

      if (file.state === FileState.FAILED) {
        throw new Error('Video processing failed.');
      }

      this.logger.log(
        `File ${file.displayName} is ready for inference as ${file.uri}`,
      );

      return file;
    } catch (error) {
      this.logger.error(`Error uploading video: ${error.message}`, error.stack);
      throw error;
    }
  }
}
