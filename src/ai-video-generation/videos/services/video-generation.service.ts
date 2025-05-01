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
import * as fs from 'fs/promises';
import * as path from 'path';
import { VideoType } from 'src/ai-video-generation/types';
import { CreatedStoriesService } from 'src/ai-video-generation/created-stories/services/created-stories.service';

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
    private readonly createdStoriesService: CreatedStoriesService,
    @InjectModel(Video.name)
    private readonly videoGenerationModel: Model<VideoDocument>,
  ) {}

  async findAll(
    seriesFilter?: string,
    typeFilter?: string,
    statusFilter?: string,
    page = 1,
    limit = 10,
  ): Promise<{ videos: Video[]; total: number; totalPages: number }> {
    const skip = (page - 1) * limit;

    let query = {};
    if (seriesFilter) {
      query = { series: seriesFilter };
    }

    if (typeFilter) {
      query = { ...query, type: typeFilter };
    } else {
      query = { ...query, type: { $ne: 'structured' } }; // Exclude structured videos by default
    }

    if (statusFilter) {
      query = { ...query, status: statusFilter };
    }

    const [videos, total] = await Promise.all([
      this.videoGenerationModel
        .find(query)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit),
      this.videoGenerationModel.countDocuments(query),
    ]);

    const totalPages = Math.ceil(total / limit);

    return {
      videos,
      total,
      totalPages,
    };
  }

  async findOne(id: string): Promise<Video | null> {
    return this.videoGenerationModel.findById(id);
  }

  async createVideoJob(generateVideoDto: GenerateVideoDto): Promise<boolean> {
    try {
      const { texts, images, series, type } = generateVideoDto;
      // Create and save VideoGeneration entity
      const videoGeneration = await this.videoGenerationModel.create({
        texts,
        series, // Add the series property
        type: type || 'basic', // Set the type with default
      });

      const videoId = String(videoGeneration._id);
      for (const [index, prompt] of images.entries()) {
        const image = await this.imageService.createImage(
          prompt,
          videoId,
          index,
        );
        this.logger.log(`Created image entity with ID: ${image._id}`);
        // Add image generation job to the queue
        await this.imageQueue.addImageGenerationJob(image);
      }

      // Create audio generation tasks
      for (const [index, text] of texts.entries()) {
        const audio = await this.audioService.createAudio(text, videoId, index);

        await this.audioQueue.addAudioGenerationJob(audio);
        this.logger.log(`Created audio entity with ID: ${audio._id}`);
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

  async setVideoDescription(
    id: string,
    description: string,
  ): Promise<Video | null> {
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
      const description = await this.aiService.generateVideoDescription(
        video.url,
      );

      await this.setVideoDescription(id, description);
      this.logger.log(`Successfully regenerated description for video ${id}`);

      return true;
    } catch (error) {
      this.logger.error(
        `Error regenerating video description: ${error.message}`,
        error.stack,
      );
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

  async setVideoUploadDate(
    id: string,
    uploadDate: Date,
  ): Promise<Video | null> {
    return await this.videoGenerationModel.findByIdAndUpdate(
      id,
      { uploadedAt: uploadDate },
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
        this.logger.error(
          `Error deleting image ${image._id}: ${error.message}`,
        );
      }
    }

    // Find and delete all related audios
    const audios = await this.audioService.findByVideoId(id);
    for (const audio of audios) {
      try {
        await this.audioService.deleteAudio(audio._id.toString());
      } catch (error) {
        this.logger.error(
          `Error deleting audio ${audio._id}: ${error.message}`,
        );
      }
    }

    // Delete the video file from Cloudinary if publicId exists
    if (video.publicId) {
      try {
        await this.cloudinaryService.deleteFile(video.publicId, 'video');
        this.logger.log(
          `Deleted video file from Cloudinary: ${video.publicId}`,
        );
      } catch (error) {
        this.logger.error(
          `Failed to delete video from Cloudinary: ${error.message}`,
        );
      }
    }

    // Delete the video record from database
    await this.videoGenerationModel.findByIdAndDelete(id).exec();
    this.logger.log(`Deleted video from database: ${id}`);
  }

  async findVideosWithoutDescription(): Promise<Video[]> {
    return this.videoGenerationModel
      .find({
        $or: [
          { description: { $exists: false } },
          { description: null },
          { description: '' },
        ],
        url: { $exists: true, $ne: null }, // Only videos that have a URL
      })
      .exec();
  }

  async generateScript(type: VideoType): Promise<string> {
    try {
      this.logger.log(`Generating script with type: ${type}`);

      let templatePath: string;

      switch (type) {
        case VideoType.BASIC:
          templatePath = path.join(
            process.cwd(),
            'public',
            'templates',
            'basic_story_step1.txt',
          );
          break;
        case VideoType.STRUCTURED:
          templatePath = path.join(
            process.cwd(),
            'public',
            'templates',
            'structured_story_step1.txt',
          );
          break;
        case VideoType.REAL:
          templatePath = path.join(
            process.cwd(),
            'public',
            'templates',
            'real_stories_step1.txt',
          );
          break;
        case VideoType.HIDDEN_BEASTS:
          templatePath = path.join(
            process.cwd(),
            'public',
            'templates',
            'hidden_beasts_step1.txt',
          );
          break;
        case VideoType.HIDDEN_FILES:
          templatePath = path.join(
            process.cwd(),
            'public',
            'templates',
            'hidden_files_step1.txt',
          );
          break;
        default:
          throw new Error(`Invalid script type: ${type}`);
      }

      // Read the template file
      const promptTemplate = await fs.readFile(templatePath, 'utf-8');
      this.logger.log(`Template loaded successfully from ${templatePath}`);

      // Get all previously created stories of this type
      const existingStories = await this.createdStoriesService.findByType(type);

      // Prepare the final prompt
      let finalPrompt = promptTemplate;

      // If there are existing stories, append a warning to not repeat them
      if (existingStories && existingStories.titles.length > 0) {
        const existingTitles = existingStories.titles.join(', ');
        finalPrompt += `\n\nThese are the stories that you have already created, do not repeat them: ${existingTitles}`;
        this.logger.log(
          `Added ${existingStories.titles.length} existing story titles to prompt`,
        );
      }

      // Generate the script using AI
      const generatedScript =
        await this.aiService.generateTextFromPrompt(finalPrompt);
      this.logger.log('Script generated successfully');

      return generatedScript;
    } catch (error) {
      this.logger.error(
        `Error generating script: ${error.message}`,
        error.stack,
      );
      throw error;
    }
  }

  async generateScriptJson(type: VideoType, text: string): Promise<string> {
    try {
      this.logger.log(
        `Generating script JSON with type: ${type} and text: ${text}`,
      );

      let templatePath: string;

      switch (type) {
        case VideoType.BASIC:
          templatePath = path.join(
            process.cwd(),
            'public',
            'templates',
            'basic_story_step2.txt',
          );
          break;
        case VideoType.STRUCTURED:
          templatePath = path.join(
            process.cwd(),
            'public',
            'templates',
            'structured_story_step2.txt',
          );
          break;
        case VideoType.REAL:
          templatePath = path.join(
            process.cwd(),
            'public',
            'templates',
            'real_stories_step2.txt',
          );
          break;
        case VideoType.HIDDEN_BEASTS:
          templatePath = path.join(
            process.cwd(),
            'public',
            'templates',
            'hidden_beasts_step2.txt',
          );
          break;
        case VideoType.HIDDEN_FILES:
          templatePath = path.join(
            process.cwd(),
            'public',
            'templates',
            'hidden_files_step2.txt',
          );
          break;
        default:
          throw new Error(`Invalid script type: ${type}`);
      }

      // Read the template file
      let promptTemplate = await fs.readFile(templatePath, 'utf-8');
      this.logger.log(`Template loaded successfully from ${templatePath}`);

      // Insert the user's text between <story></story> tags
      promptTemplate = promptTemplate.replace(
        '<story></story>',
        `<story>${text}</story>`,
      );

      // Generate the script using AI
      const generatedScript =
        await this.aiService.generateTextFromPrompt(promptTemplate);
      this.logger.log('Script JSON generated successfully');

      return generatedScript;
    } catch (error) {
      this.logger.error(
        `Error generating script JSON: ${error.message}`,
        error.stack,
      );
      throw error;
    }
  }

  async getVideosByUploadedAtMonth(
    month: number,
    year: number,
  ): Promise<Video[]> {
    const startDate = new Date(year, month - 1, 1);
    const endDate = new Date(year, month, 1);

    return this.videoGenerationModel.find({
      uploadedAt: {
        $gte: startDate,
        $lt: endDate,
      },
    });
  }

  async getMusicByVideoId(videoId: string): Promise<string> {
    try {
      // Find the video by id
      const video = await this.videoGenerationModel.findById(videoId);

      if (!video) {
        throw new NotFoundException(`Video with ID ${videoId} not found`);
      }

      // Get the video type and return the music path
      return `public/music/${video.type}.mp3`;
    } catch (error) {
      this.logger.error(
        `Error getting music for video ${videoId}: ${error.message}`,
        error.stack,
      );
      throw error;
    }
  }

  getMusicVolumeByType(type: string): number {
    switch (type) {
      case VideoType.HIDDEN_BEASTS:
        return 0.05;
      case VideoType.HIDDEN_FILES:
        return 0.3;
      case VideoType.BASIC:
        return 0.25;
      case VideoType.REAL:
      default:
        return 0.2;
    }
  }
}
