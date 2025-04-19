import { Injectable, NotFoundException, Logger } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { CreateVideoDto } from './dto/create-video.dto';
import { AiService } from '../ai/ai.service';
import { GoogleAIUploadService } from '../google-ai-upload/google-ai-upload.service';
import { CloudinaryService } from '../cloudinary/cloudinary.service';
import {
  AutomatedMedia,
  AutomatedMediaDocument,
} from './schemas/automated-media.schema';

@Injectable()
export class AutomatedMediaService {
  private readonly logger = new Logger(AutomatedMediaService.name);

  constructor(
    @InjectModel(AutomatedMedia.name)
    private readonly videoModel: Model<AutomatedMediaDocument>,
    private readonly aiService: AiService,
    private readonly googleAIUploadService: GoogleAIUploadService,
    private readonly cloudinaryService: CloudinaryService,
  ) {}

  async create(createVideoDto: CreateVideoDto): Promise<boolean> {
    try {
      const existingVideo = await this.videoModel
        .findOne({ url: createVideoDto.url })
        .exec();

      if (existingVideo) {
        this.logger.warn(`Video with URL ${createVideoDto.url} already exists`);
        return false;
      }

      const newVideo = new this.videoModel(createVideoDto);
      await newVideo.save();
      this.logger.log(`Video created with ID: ${newVideo._id}`);
      return true;
    } catch (error) {
      this.logger.error(`Error creating video: ${error.message}`, error.stack);
      throw new Error('Failed to create video');
    }
  }

  async findAll(): Promise<AutomatedMedia[]> {
    return this.videoModel.find().exec();
  }

  async findOne(id: string): Promise<AutomatedMedia> {
    const video = await this.videoModel.findById(id).exec();
    if (!video) {
      throw new NotFoundException(`Video with ID ${id} not found`);
    }
    return video;
  }

  async remove(id: string): Promise<void> {
    try {
      // First, find the video to get the publicId
      const video = await this.videoModel.findById(id).exec();
      if (!video) {
        throw new NotFoundException(`Video with ID ${id} not found`);
      }

      // If video has a publicId, delete from Cloudinary first
      if (video.publicId) {
        try {
          this.logger.log(
            `Attempting to delete from Cloudinary: ${video.publicId}`,
          );
          await this.cloudinaryService.deleteFile(video.publicId);
          this.logger.log(
            `Successfully deleted from Cloudinary: ${video.publicId}`,
          );
        } catch (error) {
          this.logger.error(
            `Error deleting from Cloudinary: ${error.message}. Continuing with database deletion.`,
            error.stack,
          );
          // We continue with database deletion even if Cloudinary deletion fails
        }
      }

      // Delete from database
      const result = await this.videoModel.deleteOne({ _id: id }).exec();
      if (result.deletedCount === 0) {
        throw new NotFoundException(`Video with ID ${id} not found`);
      }

      this.logger.log(`Successfully deleted video with ID ${id} from database`);
    } catch (error) {
      this.logger.error(`Error removing video: ${error.message}`, error.stack);
      throw error;
    }
  }

  async findVideosWithoutDescriptionAndNotUploaded(): Promise<
    AutomatedMedia[]
  > {
    return this.videoModel
      .find({
        $or: [
          { description: { $exists: false } },
          { description: null },
          { description: '' },
        ],
        uploaded: false,
      })
      .exec();
  }

  async selectRandomVideoWithoutDescription(): Promise<AutomatedMedia | null> {
    try {
      const videos = await this.findVideosWithoutDescriptionAndNotUploaded();

      if (!videos || videos.length === 0) {
        this.logger.warn(
          'No videos found without description and not uploaded',
        );
        return null;
      }

      const randomIndex = Math.floor(Math.random() * videos.length);
      return videos[randomIndex];
    } catch (error) {
      this.logger.error(
        `Error selecting random video: ${error.message}`,
        error.stack,
      );
      return null;
    }
  }

  async findVideosWithDescriptionAndNotUploaded(): Promise<AutomatedMedia[]> {
    return this.videoModel
      .find({
        description: { $exists: true, $ne: null },
        uploaded: false,
      })
      .exec();
  }

  async selectRandomVideoWithDescription(): Promise<AutomatedMedia | null> {
    try {
      const videos = await this.findVideosWithDescriptionAndNotUploaded();

      if (!videos || videos.length === 0) {
        this.logger.warn('No videos found with description and not uploaded');
        return null;
      }

      const randomIndex = Math.floor(Math.random() * videos.length);
      return videos[randomIndex];
    } catch (error) {
      this.logger.error(
        `Error selecting random video with description: ${error.message}`,
        error.stack,
      );
      return null;
    }
  }

  async generateDescriptionForRandomVideo(): Promise<AutomatedMedia | null> {
    this.logger.log('Generating description for a random video');

    const selectedVideo = await this.selectRandomVideoWithoutDescription();

    if (!selectedVideo) {
      return null;
    }

    this.logger.log(
      `Selected video: ${selectedVideo._id} with URL: ${selectedVideo.url}`,
    );

    try {
      // Upload the video using the GoogleAIUploadService
      this.logger.log('Uploading video using GoogleAIUploadService');
      const file = await this.googleAIUploadService.uploadVideoFromUrl(
        selectedVideo.url,
      );

      this.logger.log(
        `File ${file.displayName} is ready for inference as ${file.uri}`,
      );

      // Generate description using the AI service with the File API data
      this.logger.log('Generating description with AI using File API');
      const result = await this.aiService.generateVideoDescriptionWithFileData(
        file.mimeType,
        file.uri,
      );

      this.logger.log('Description generated successfully');

      // Update the video with the generated description
      const updatedVideo = await this.videoModel
        .findByIdAndUpdate(
          selectedVideo._id,
          { description: result },
          { new: true },
        )
        .exec();

      this.logger.log(
        `Updated video ${selectedVideo._id} with new description`,
      );

      return updatedVideo;
    } catch (error) {
      this.logger.error(
        `Error during video processing: ${error.message}`,
        error.stack,
      );
      return null;
    }
  }

  async generateDescriptionForVideo(
    id: string,
  ): Promise<AutomatedMedia | null> {
    this.logger.log(`Generating description for video with ID: ${id}`);

    try {
      const video = await this.videoModel.findById(id).exec();
      if (!video) {
        throw new NotFoundException(`Video with ID ${id} not found`);
      }

      this.logger.log(`Found video: ${video._id} with URL: ${video.url}`);

      // Upload the video using the GoogleAIUploadService
      this.logger.log('Uploading video using GoogleAIUploadService');
      const file = await this.googleAIUploadService.uploadVideoFromUrl(
        video.url,
      );

      this.logger.log(
        `File ${file.displayName} is ready for inference as ${file.uri}`,
      );

      // Generate description using the AI service with the File API data
      this.logger.log('Generating description with AI using File API');
      const result = await this.aiService.generateVideoDescriptionWithFileData(
        file.mimeType,
        file.uri,
      );

      this.logger.log('Description generated successfully');

      // Update the video with the generated description
      const updatedVideo = await this.videoModel
        .findByIdAndUpdate(video._id, { description: result }, { new: true })
        .exec();

      this.logger.log(`Updated video ${video._id} with new description`);

      return updatedVideo;
    } catch (error) {
      this.logger.error(
        `Error during video processing: ${error.message}`,
        error.stack,
      );
      throw error;
    }
  }

  async markAsUploaded(id: string): Promise<AutomatedMedia> {
    try {
      this.logger.log(`Marking video with ID ${id} as uploaded`);

      const updatedVideo = await this.videoModel
        .findByIdAndUpdate(id, { uploaded: true }, { new: true })
        .exec();

      if (!updatedVideo) {
        throw new NotFoundException(`Video with ID ${id} not found`);
      }

      this.logger.log(`Successfully marked video ${id} as uploaded`);
      return updatedVideo;
    } catch (error) {
      this.logger.error(
        `Error marking video as uploaded: ${error.message}`,
        error.stack,
      );
      throw error;
    }
  }
}
