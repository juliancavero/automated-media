import { Injectable, Logger } from '@nestjs/common';
import { GenerateVideoDto } from './dto/generate-video.dto';
import { AudioQueueService } from '../audio/audio-queue.service';
import { ImageQueueService } from '../image-generation/image-queue.service';
import { VideoQueueService } from '../video/video-queue.service';
import {
  VideoGeneration,
  VideoGenerationDocument,
} from './entities/video-generation.entity';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';

@Injectable()
export class VideoGenerationService {
  private readonly logger = new Logger(VideoGenerationService.name);

  constructor(
    private readonly imageQueue: ImageQueueService,
    private readonly audioQueue: AudioQueueService,
    private readonly videoQueue: VideoQueueService,
    @InjectModel(VideoGeneration.name)
    private readonly videoGenerationModel: Model<VideoGenerationDocument>,
  ) {}

  async findAll(): Promise<VideoGeneration[]> {
    return this.videoGenerationModel.find({
      order: { createdAt: 'DESC' },
    });
  }

  async generateVideo(generateVideoDto: GenerateVideoDto): Promise<boolean> {
    try {
      const { texts, options } = generateVideoDto;
      // Create and save VideoGeneration entity
      const videoGeneration = await this.videoGenerationModel.create({
        texts,
        options,
      });

      const videoId = String(videoGeneration._id);

      // Generate a unique ID for this video
      this.logger.log(`Generating video with ID: ${videoId}`);

      const jobIds: string[] = [];

      // Create image generation tasks
      this.logger.log('Creating image generation tasks');
      for (const [index, text] of texts.entries()) {
        const jobId = await this.imageQueue.addImageGenerationJob(
          text,
          videoId,
          index,
        );
        jobIds.push(jobId);
        this.logger.log(
          `Added image generation task for text ${index + 1} with order ${index}, jobId: ${jobId}`,
        );
      }

      // Create audio generation tasks
      this.logger.log('Creating audio generation tasks');
      for (const [index, text] of texts.entries()) {
        const jobId = await this.audioQueue.addAudioGenerationJob(
          text,
          videoId,
          index,
          options,
        );
        jobIds.push(jobId);
        this.logger.log(
          `Added audio generation task for text ${index + 1} with order ${index}, jobId: ${jobId}`,
        );
      }

      // Create a consolidation job that will check when all jobs are completed
      await this.videoQueue.addVideoConsolidationJob(jobIds, videoId);
      this.logger.log(`Added video consolidation job for videoId: ${videoId}`);

      videoGeneration.jobs = jobIds;
      await videoGeneration.save();

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

  async findById(id: string): Promise<VideoGeneration | null> {
    return this.videoGenerationModel.findById(id);
  }

  async update(
    id: string,
    videoGeneration: VideoGeneration,
  ): Promise<VideoGeneration | null> {
    return this.videoGenerationModel.findByIdAndUpdate(id, videoGeneration, {
      new: true,
    });
  }
}
