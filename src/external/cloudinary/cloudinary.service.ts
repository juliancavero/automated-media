import { Injectable, Logger } from '@nestjs/common';
import { v2 as cloudinary } from 'cloudinary';
import { Readable } from 'stream';

@Injectable()
export class CloudinaryService {
  private readonly logger = new Logger(CloudinaryService.name);

  constructor() {
    cloudinary.config({
      cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
      api_key: process.env.CLOUDINARY_API_KEY,
      api_secret: process.env.CLOUDINARY_API_SECRET,
    });
  }

  async upload(file: Buffer): Promise<{ url: string; public_id: string }> {
    try {
      this.logger.log(`Uploading file to Cloudinary`);
      return new Promise((resolve, reject) => {
        const uploadStream = cloudinary.uploader.upload_stream(
          {
            resource_type: 'auto',
            folder: 'automated-media',
          },
          (error, result) => {
            if (error) {
              this.logger.error(
                `Failed to upload file to Cloudinary: ${error.message}`,
                error.stack,
              );
              return reject(new Error('Cloudinary upload failed'));
            }
            if (!result) {
              this.logger.error(
                `Cloudinary upload returned no result for file`,
              );
              return reject(new Error('No result from Cloudinary'));
            }
            this.logger.log(`File uploaded successfully to Cloudinary`);
            return resolve({
              url: result.secure_url,
              public_id: result.public_id,
            });
          },
        );
        // Convert buffer to Readable Stream
        const readableStream = new Readable();
        readableStream.push(file);
        readableStream.push(null);
        readableStream.pipe(uploadStream);
      });
    } catch (error) {
      this.logger.error(`Error in uploadVideo: ${error.message}`, error.stack);
      throw error;
    }
  }

  async deleteFile(publicId: string, resourceType?: string): Promise<boolean> {
    try {
      this.logger.log(
        `Deleting file with public ID: ${publicId} from Cloudinary`,
      );

      // Auto-detect resource type from publicId if not provided
      const detectedResourceType = resourceType || this.detectResourceType(publicId);

      return new Promise((resolve, reject) => {
        cloudinary.uploader.destroy(
          publicId,
          { resource_type: detectedResourceType },
          (error, result) => {
            if (error) {
              this.logger.error(
                `Failed to delete file from Cloudinary: ${error.message}`,
                error.stack,
              );
              return reject(new Error('Cloudinary deletion failed'));
            }

            this.logger.log(
              `File with public ID ${publicId} deleted successfully from Cloudinary`,
            );

            // result.result will be 'ok' if deletion was successful
            return resolve(result.result === 'ok');
          },
        );
      });
    } catch (error) {
      this.logger.error(`Error in deleteFile: ${error.message}`, error.stack);
      throw error;
    }
  }

  /**
   * Detects the resource type based on the publicId
   * @param publicId Cloudinary public ID
   * @returns Resource type (video, image, or raw)
   */
  private detectResourceType(publicId: string): string {
    // Common video extensions
    const videoExts = ['mp4', 'mov', 'avi', 'wmv', 'flv', 'mkv', 'webm'];
    // Common image extensions
    const imageExts = ['jpg', 'jpeg', 'png', 'gif', 'bmp', 'webp', 'svg'];
    // Common audio extensions
    const audioExts = ['mp3', 'wav', 'ogg', 'aac', 'm4a'];

    // Extract extension if available in publicId
    const parts = publicId.split('.');
    const ext = parts.length > 1 ? parts[parts.length - 1].toLowerCase() : '';

    if (videoExts.includes(ext)) return 'video';
    if (imageExts.includes(ext)) return 'image';
    if (audioExts.includes(ext)) return 'video'; // Audio files are stored as video type in Cloudinary

    // Default to auto detection
    // For folder structure format: "automated-media/abcd1234"
    if (publicId.includes('video')) return 'video';
    if (publicId.includes('image')) return 'image';
    if (publicId.includes('audio')) return 'video'; // Audio is stored as video type

    // Default to video as the safest option
    return 'auto';
  }
}
