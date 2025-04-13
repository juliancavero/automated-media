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

  async uploadFile(
    file: Express.Multer.File,
  ): Promise<{ url: string; public_id: string }> {
    try {
      this.logger.log(`Uploading file ${file.originalname} to Cloudinary`);

      return new Promise((resolve, reject) => {
        const uploadStream = cloudinary.uploader.upload_stream(
          {
            resource_type: 'video',
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
                `Cloudinary upload returned no result for file ${file.originalname}`,
              );
              return reject(new Error('No result from Cloudinary'));
            }

            this.logger.log(
              `File ${file.originalname} uploaded successfully to Cloudinary`,
            );
            return resolve({
              url: result.secure_url,
              public_id: result.public_id,
            });
          },
        );

        // Convert buffer to Readable Stream
        const readableStream = new Readable();
        readableStream.push(file.buffer);
        readableStream.push(null);
        readableStream.pipe(uploadStream);
      });
    } catch (error) {
      this.logger.error(`Error in uploadFile: ${error.message}`, error.stack);
      throw error;
    }
  }

  async uploadVideo(
    video: Buffer,
  ): Promise<{ url: string; public_id: string }> {
    try {
      this.logger.log(`Uploading video to Cloudinary`);
      return new Promise((resolve, reject) => {
        const uploadStream = cloudinary.uploader.upload_stream(
          {
            resource_type: 'video',
            folder: 'automated-media',
          },
          (error, result) => {
            if (error) {
              this.logger.error(
                `Failed to upload video to Cloudinary: ${error.message}`,
                error.stack,
              );
              return reject(new Error('Cloudinary upload failed'));
            }
            if (!result) {
              this.logger.error(
                `Cloudinary upload returned no result for video`,
              );
              return reject(new Error('No result from Cloudinary'));
            }
            this.logger.log(`Video uploaded successfully to Cloudinary`);
            return resolve({
              url: result.secure_url,
              public_id: result.public_id,
            });
          },
        );
        // Convert buffer to Readable Stream
        const readableStream = new Readable();
        readableStream.push(video);
        readableStream.push(null);
        readableStream.pipe(uploadStream);
      });
    } catch (error) {
      this.logger.error(`Error in uploadVideo: ${error.message}`, error.stack);
      throw error;
    }
  }

  async deleteFile(publicId: string): Promise<boolean> {
    try {
      this.logger.log(
        `Deleting file with public ID: ${publicId} from Cloudinary`,
      );

      return new Promise((resolve, reject) => {
        cloudinary.uploader.destroy(
          publicId,
          { resource_type: 'video' },
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
}
