import { Injectable, NotFoundException, Logger } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { Audio, AudioDocument } from '../schemas/audio.schema';
import { AudioQueueService } from '../queues/audio-queue.service';
import { CloudinaryService } from 'src/external/cloudinary/cloudinary.service';
import { Languages, Status } from 'src/ai-video-generation/types';
import { ObjectId } from 'mongodb';

@Injectable()
export class AudioService {
  private readonly logger = new Logger(AudioService.name);

  constructor(
    @InjectModel(Audio.name)
    private readonly audioModel: Model<AudioDocument>,
    private readonly audioQueueService: AudioQueueService,
    private readonly cloudinaryService: CloudinaryService,
  ) {}

  async createAudio(
    text: string,
    videoId: string,
    order: number,
    lang: string,
    configId: ObjectId,
  ): Promise<Audio> {
    return await this.audioModel.create({
      text,
      videoId,
      order,
      lang,
      configId,
    });
  }

  async copyAudio(
    id: string,
    videoId: string,
    text: string,
    lang: Languages,
  ): Promise<Audio | null> {
    const audio = await this.audioModel.findById(id).exec();
    if (!audio) {
      throw new NotFoundException(`Audio with ID ${id} not found`);
    }

    return this.audioModel.create({
      ...audio.toObject(),
      videoId,
      text,
      lang,
      _id: undefined, // Ensure a new ID is generated
      status: Status.PENDING, // Reset status to pending
      createdAt: undefined, // Ensure createdAt is set to now
      updatedAt: undefined, // Ensure updatedAt is set to now
      publicId: undefined, // Ensure publicId is reset
      url: undefined, // Ensure URL is reset
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
        this.logger.log(
          `Deleted audio file from Cloudinary: ${audio.publicId}`,
        );
      } catch (error) {
        this.logger.error(
          `Failed to delete audio from Cloudinary: ${error.message}`,
        );
      }
    }

    // Delete from database
    await this.audioModel.findByIdAndDelete(id).exec();
    this.logger.log(`Deleted audio from database: ${id}`);
  }

  async getAllAudios(
    page = 1,
    limit = 10,
    lang = Languages.ES,
  ): Promise<{ audios: Audio[]; total: number; pages: number }> {
    const skip = (page - 1) * limit;
    const [audios, total] = await Promise.all([
      this.audioModel
        .find({ lang })
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .exec(),
      this.audioModel.countDocuments(),
    ]);

    const pages = Math.ceil(total / limit);

    return { audios, total, pages };
  }

  async findByVideoId(videoId: string): Promise<Audio[]> {
    return await this.audioModel.find({ videoId }).sort({ order: 1 }).exec();
  }

  async setAudioUrl(id: string, url: string, publicId: string): Promise<Audio> {
    const updatedAudio = await this.audioModel
      .findByIdAndUpdate(
        id,
        { url, publicId, status: Status.FINISHED },
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
      .find({ status: Status.PENDING || Status.ERROR })
      .exec();

    for (const audio of failedAudios) {
      await this.audioQueueService.addAudioGenerationJob(audio);
    }
  }

  async regenerateAudio(id: string): Promise<void> {
    const audio = await this.audioModel.findById(id);
    if (!audio) {
      throw new Error('Audio not found');
    }

    // Reset the audio status to pending
    await this.audioModel
      .findByIdAndUpdate(
        id,
        { status: Status.PENDING, url: null, publicId: null },
        { runValidators: true },
      )
      .exec();

    // Add to the queue
    await this.audioQueueService.addAudioGenerationJob(audio);
  }

  async setStatus(id: string, status: Status): Promise<Audio | null> {
    return this.audioModel.findByIdAndUpdate(
      id,
      { status },
      { new: true, runValidators: true },
    );
  }
}
