import { Injectable, NotFoundException, Logger } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { Audio, AudioDocument } from '../schemas/audio.schema';
import { AudioQueueService } from '../queues/audio-queue.service';
import { CloudinaryService } from 'src/external/cloudinary/cloudinary.service';

@Injectable()
export class AudioService {
  private readonly logger = new Logger(AudioService.name);

  constructor(
    @InjectModel(Audio.name)
    private readonly audioModel: Model<AudioDocument>,
    private readonly audioQueueService: AudioQueueService,
    private readonly cloudinaryService: CloudinaryService,
  ) { }

  async createAudio(
    text: string,
    videoId: string,
    order: number,
  ): Promise<Audio> {
    return await this.audioModel.create({
      text,
      videoId,
      order,
    });
  }

  async getAudioById(id: string): Promise<Audio> {
    const audio = await this.audioModel.findById(id).exec();
    if (!audio) {
      throw new NotFoundException(`Audio with ID ${id} not found`);
    }
    return audio;
  }

  async deleteAudio(id: string): Promise<void> {
    const audio = await this.audioModel.findById(id).exec();
    if (!audio) {
      throw new NotFoundException(`Audio with ID ${id} not found`);
    }

    // Delete from Cloudinary if publicId exists
    if (audio.publicId) {
      try {
        await this.cloudinaryService.deleteFile(audio.publicId, 'video');
        this.logger.log(`Deleted audio file from Cloudinary: ${audio.publicId}`);
      } catch (error) {
        this.logger.error(`Failed to delete audio from Cloudinary: ${error.message}`);
      }
    }

    // Delete from database
    await this.audioModel.findByIdAndDelete(id).exec();
    this.logger.log(`Deleted audio from database: ${id}`);
  }

  async getAllAudios(): Promise<Audio[]> {
    return await this.audioModel.find().sort({ createdAt: -1 }).exec();
  }

  async findByVideoId(videoId: string): Promise<Audio[]> {
    return await this.audioModel.find({ videoId }).sort({ order: 1 }).exec();
  }

  async setAudioUrl(id: string, url: string, publicId: string): Promise<Audio> {
    const updatedAudio = await this.audioModel
      .findByIdAndUpdate(
        id,
        { url, publicId, status: 'finished' },
        { new: true, runValidators: true },
      )
      .exec();

    if (!updatedAudio) {
      throw new NotFoundException(`Audio with ID ${id} not found`);
    }

    return updatedAudio;
  }

  async relaunchFailedAudios(): Promise<void> {
    const failedAudios = await this.audioModel
      .find({ status: 'pending' })
      .exec();

    for (const audio of failedAudios) {
      await this.audioQueueService.addAudioGenerationJob(audio);
    }
  }
}
