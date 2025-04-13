import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import {
  StoredAudio,
  StoredAudioDocument,
} from './schemas/stored-audio.schema';
import { CreateStoredAudioDto } from './dto/create-stored-audio.dto';

@Injectable()
export class AudioStorageService {
  private readonly logger = new Logger(AudioStorageService.name);

  constructor(
    @InjectModel(StoredAudio.name)
    private readonly storedAudioModel: Model<StoredAudioDocument>,
  ) {}

  async saveAudio(
    body: CreateStoredAudioDto,
    videoId: string,
    order: number,
  ): Promise<StoredAudio> {
    const savedAudio = await this.storedAudioModel.create({
      ...body,
      videoId,
      order,
    });
    this.logger.log(`Image saved to MongoDB with ID: ${savedAudio._id}`);

    return savedAudio;
  }

  async getAudioById(id: string): Promise<StoredAudio> {
    try {
      const audio = await this.storedAudioModel.findById(id).exec();
      if (!audio) {
        throw new NotFoundException(`Audio with ID ${id} not found`);
      }
      return audio;
    } catch (error) {
      this.logger.error(
        `Error retrieving audio with ID ${id}: ${error.message}`,
      );
      throw error;
    }
  }

  async deleteAudio(id: string): Promise<boolean> {
    try {
      const result = await this.storedAudioModel.deleteOne({ _id: id }).exec();
      return result.deletedCount > 0;
    } catch (error) {
      this.logger.error(`Error deleting audio with ID ${id}: ${error.message}`);
      throw error;
    }
  }

  async getAllAudios(): Promise<StoredAudio[]> {
    try {
      return await this.storedAudioModel.find().sort({ createdAt: -1 }).exec();
    } catch (error) {
      this.logger.error(`Error retrieving all audios: ${error.message}`);
      throw error;
    }
  }
}
