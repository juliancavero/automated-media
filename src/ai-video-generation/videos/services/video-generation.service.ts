import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { GenerateVideoDto } from '../dto/generate-video.dto';
import { ImageQueueService } from '../../images/queues/image-queue.service';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { AudioQueueService } from 'src/ai-video-generation/audios/queues/audio-queue.service';
import { Video, VideoDocument } from '../entities/video.schema';
import { ImageService } from 'src/ai-video-generation/images/services/image.service';
import { AudioService } from 'src/ai-video-generation/audios/services/audio.service';
import { CloudinaryService } from 'src/external/cloudinary/cloudinary.service';
import { AiService } from 'src/external/ai/ai.service';

@Injectable()
export class VideoGenerationService {
  private readonly logger = new Logger(VideoGenerationService.name);

  constructor(
    private readonly imageQueue: ImageQueueService,
    private readonly audioQueue: AudioQueueService,
    private readonly imageService: ImageService,
    private readonly audioService: AudioService,
    private readonly cloudinaryService: CloudinaryService,
    private readonly aiService: AiService,
    @InjectModel(Video.name)
    private readonly videoGenerationModel: Model<VideoDocument>,
  ) { }

  async findAll(seriesFilter?: string, page = 1, limit = 10): Promise<{ videos: Video[], total: number, totalPages: number }> {
    const skip = (page - 1) * limit;

    let query = {};
    if (seriesFilter) {
      query = { series: seriesFilter };
    }

    const [videos, total] = await Promise.all([
      this.videoGenerationModel.find(query)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit),
      this.videoGenerationModel.countDocuments(query)
    ]);

    const totalPages = Math.ceil(total / limit);

    return {
      videos,
      total,
      totalPages
    };
  }

  async findOne(id: string): Promise<Video | null> {
    return this.videoGenerationModel.findById(id);
  }

  async createVideoJob(generateVideoDto: GenerateVideoDto): Promise<boolean> {
    try {
      const { texts, images, series } = generateVideoDto;
      // Create and save VideoGeneration entity
      const videoGeneration = await this.videoGenerationModel.create({
        texts,
        series, // Add the series property
      });

      const videoId = String(videoGeneration._id);
      for (const [index, prompt] of images.entries()) {
        const image = await this.imageService.createImage(prompt, videoId, index);
        this.logger.log(`Created image entity with ID: ${image._id}`);
        // Add image generation job to the queue
        await this.imageQueue.addImageGenerationJob(image);
      }

      // Create audio generation tasks
      for (const [index, text] of texts.entries()) {
        const audio = await this.audioService.createAudio(text, videoId, index);

        await this.audioQueue.addAudioGenerationJob(audio);
        this.logger.log(
          `Created audio entity with ID: ${audio._id}`
        );
      }

      this.logger.log(`Saved VideoGeneration entity with ID: ${videoId}`);

      return true;
    } catch (error) {
      this.logger.error(
        `Error generating video: ${error.message}`,
        error.stack,
      );
      return false;
    }
  }

  async findById(id: string): Promise<Video | null> {
    return this.videoGenerationModel.findById(id);
  }

  async update(id: string, videoGeneration: Video): Promise<Video | null> {
    return this.videoGenerationModel.findByIdAndUpdate(id, videoGeneration, {
      new: true,
    });
  }

  async setVideoUrl(
    id: string,
    url: string,
    publicId: string,
    status: string,
  ): Promise<Video | null> {
    return await this.videoGenerationModel.findByIdAndUpdate(
      id,
      { url, publicId, status },
      { new: true, runValidators: true },
    );
  }

  async setVideoDescription(id: string, description: string): Promise<Video | null> {
    return await this.videoGenerationModel.findByIdAndUpdate(
      id,
      { description },
      { new: true, runValidators: true },
    );
  }

  async regenerateVideoDescription(id: string): Promise<boolean> {
    try {
      const video = await this.videoGenerationModel.findById(id);

      if (!video || !video.url) {
        this.logger.error(`Video with ID ${id} not found or has no URL`);
        return false;
      }

      this.logger.log(`Regenerating description for video ${id}`);
      const description = await this.aiService.generateVideoDescription(video.url);

      await this.setVideoDescription(id, description);
      this.logger.log(`Successfully regenerated description for video ${id}`);

      return true;
    } catch (error) {
      this.logger.error(`Error regenerating video description: ${error.message}`, error.stack);
      return false;
    }
  }

  async setVideoUploaded(id: string): Promise<Video | null> {
    return await this.videoGenerationModel.findByIdAndUpdate(
      id,
      { status: 'uploaded' },
      { new: true, runValidators: true },
    );
  }

  async deleteVideo(id: string): Promise<void> {
    const video = await this.videoGenerationModel.findById(id).exec();
    if (!video) {
      throw new NotFoundException(`Video with ID ${id} not found`);
    }

    // First, delete all related images and audios
    this.logger.log(`Deleting related images and audios for video ${id}`);

    // Find and delete all related images
    const images = await this.imageService.findByVideoId(id);
    for (const image of images) {
      try {
        await this.imageService.deleteImage(image._id.toString());
      } catch (error) {
        this.logger.error(`Error deleting image ${image._id}: ${error.message}`);
      }
    }

    // Find and delete all related audios
    const audios = await this.audioService.findByVideoId(id);
    for (const audio of audios) {
      try {
        await this.audioService.deleteAudio(audio._id.toString());
      } catch (error) {
        this.logger.error(`Error deleting audio ${audio._id}: ${error.message}`);
      }
    }

    // Delete the video file from Cloudinary if publicId exists
    if (video.publicId) {
      try {
        await this.cloudinaryService.deleteFile(video.publicId, 'video');
        this.logger.log(`Deleted video file from Cloudinary: ${video.publicId}`);
      } catch (error) {
        this.logger.error(`Failed to delete video from Cloudinary: ${error.message}`);
      }
    }

    // Delete the video record from database
    await this.videoGenerationModel.findByIdAndDelete(id).exec();
    this.logger.log(`Deleted video from database: ${id}`);
  }
}
