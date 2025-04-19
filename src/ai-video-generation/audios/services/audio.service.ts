import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { Audio, AudioDocument } from '../schemas/audio.schema';

@Injectable()
export class AudioService {
  constructor(
    @InjectModel(Audio.name)
    private readonly audioModel: Model<AudioDocument>,
  ) {}

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
    await this.audioModel.findByIdAndDelete(id).exec();
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
}
