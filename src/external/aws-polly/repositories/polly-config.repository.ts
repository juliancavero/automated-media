import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { PollyConfig } from '../schemas/polly-config.schema';
import { Languages } from 'src/ai-video-generation/types';

@Injectable()
export class PollyConfigRepository {
  constructor(
    @InjectModel(PollyConfig.name)
    private readonly pollyConfigModel: Model<PollyConfig>,
  ) {}

  async findOne(lang: Languages): Promise<PollyConfig | null> {
    return this.pollyConfigModel.findOne({ lang }).exec();
  }

  async findById(id: string): Promise<PollyConfig | null> {
    return this.pollyConfigModel.findById(id).exec();
  }

  async create(pollyConfig: Partial<PollyConfig>): Promise<PollyConfig> {
    const newConfig = new this.pollyConfigModel({
      ...pollyConfig,
    });
    return newConfig.save();
  }

  async update(
    id: string,
    pollyConfig: Partial<PollyConfig>,
  ): Promise<PollyConfig | null> {
    return this.pollyConfigModel
      .findByIdAndUpdate(id, pollyConfig, { new: true })
      .exec();
  }
}
