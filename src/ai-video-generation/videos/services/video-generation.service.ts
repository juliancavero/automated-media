import { Injectable, Logger } from '@nestjs/common';
import { GenerateVideoDto } from '../dto/generate-video.dto';
import { ImageQueueService } from '../../images/queues/image-queue.service';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { AudioQueueService } from 'src/ai-video-generation/audios/queues/audio-queue.service';
import { Video, VideoDocument } from '../entities/video.schema';
import { ImageService } from 'src/ai-video-generation/images/services/image.service';
import { AudioService } from 'src/ai-video-generation/audios/services/audio.service';

@Injectable()
export class VideoGenerationService {
  private readonly logger = new Logger(VideoGenerationService.name);

  constructor(
    private readonly imageQueue: ImageQueueService,
    private readonly audioQueue: AudioQueueService,
    private readonly imageService: ImageService,
    private readonly audioService: AudioService,
    @InjectModel(Video.name)
    private readonly videoGenerationModel: Model<VideoDocument>,
  ) { }

  async findAll(): Promise<Video[]> {
    return this.videoGenerationModel.find();
  }

  async findOne(id: string): Promise<Video | null> {
    return this.videoGenerationModel.findById(id);
  }

  async createVideoJob(generateVideoDto: GenerateVideoDto): Promise<boolean> {
    try {
      const { texts, images } = generateVideoDto;
      // Create and save VideoGeneration entity
      const videoGeneration = await this.videoGenerationModel.create({
        texts,
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
  ): Promise<Video | null> {
    return await this.videoGenerationModel.findByIdAndUpdate(
      id,
      { url, publicId, status: 'finished' },
      { new: true, runValidators: true },
    );
  }
}
