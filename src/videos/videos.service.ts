import { Injectable, NotFoundException, Logger } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { CreateVideoDto } from './dto/create-video.dto';
import { UpdateVideoDto } from './dto/update-video.dto';
import { Video, VideoDocument } from './schemas/video.schema';
import { AiService } from '../ai/ai.service';
import { GoogleAIUploadService } from '../google-ai-upload/google-ai-upload.service';

@Injectable()
export class VideosService {
  private readonly logger = new Logger(VideosService.name);

  constructor(
    @InjectModel(Video.name) private videoModel: Model<VideoDocument>,
    private aiService: AiService,
    private googleAIUploadService: GoogleAIUploadService,
  ) {}

  async create(createVideoDto: CreateVideoDto): Promise<Video> {
    const newVideo = new this.videoModel(createVideoDto);
    return newVideo.save();
  }

  async findAll(): Promise<Video[]> {
    return this.videoModel.find().exec();
  }

  async findOne(id: string): Promise<Video> {
    const video = await this.videoModel.findById(id).exec();
    if (!video) {
      throw new NotFoundException(`Video with ID ${id} not found`);
    }
    return video;
  }

  async update(id: string, updateVideoDto: UpdateVideoDto): Promise<Video> {
    const updatedVideo = await this.videoModel
      .findByIdAndUpdate(id, updateVideoDto, { new: true })
      .exec();

    if (!updatedVideo) {
      throw new NotFoundException(`Video with ID ${id} not found`);
    }

    return updatedVideo;
  }

  async remove(id: string): Promise<void> {
    const result = await this.videoModel.deleteOne({ _id: id }).exec();
    if (result.deletedCount === 0) {
      throw new NotFoundException(`Video with ID ${id} not found`);
    }
  }

  async findVideosWithoutDescriptionAndNotUploaded(): Promise<Video[]> {
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

  async selectRandomVideoWithoutDescription(): Promise<Video | null> {
    const videos = await this.findVideosWithoutDescriptionAndNotUploaded();

    if (!videos || videos.length === 0) {
      this.logger.warn('No videos found without description and not uploaded');
      return null;
    }

    const randomIndex = Math.floor(Math.random() * videos.length);
    return videos[randomIndex];
  }

  async generateDescriptionForRandomVideo(): Promise<Video | null> {
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
}
