import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { PollyConfig } from '../schemas/polly-config.schema';
import { Languages } from 'src/ai-video-generation/types';
import { ObjectId } from 'mongodb';

@Injectable()
export class PollyConfigRepository {
  constructor(
    @InjectModel(PollyConfig.name)
    private readonly pollyConfigModel: Model<PollyConfig>,
  ) {}

  async findOne(lang: Languages): Promise<PollyConfig | null> {
    return this.pollyConfigModel.findOne({ lang, enabled: true }).exec();
  }

  async findOneByLangAndDefault(
    lang: Languages,
    isDefault: boolean = true,
  ): Promise<PollyConfig | null> {
    return this.pollyConfigModel
      .findOne({ lang, isDefault, enabled: true })
      .exec();
  }

  async findOneByVoiceId(
    voiceId: string,
    lang: Languages,
  ): Promise<PollyConfig | null> {
    return this.pollyConfigModel
      .findOne({ voiceId, lang, enabled: true })
      .exec();
  }

  async findOneBy(
    lang: Languages,
    isDefault: boolean = true,
  ): Promise<PollyConfig | null> {
    return this.pollyConfigModel
      .findOne({ lang, isDefault, enabled: true })
      .exec();
  }

  async findById(id: string): Promise<PollyConfig | null> {
    return this.pollyConfigModel.findById(id).exec();
  }

  async find(params: any): Promise<PollyConfig[]> {
    return this.pollyConfigModel.find({ ...params, enabled: true }).exec();
  }

  async create(pollyConfig: Partial<PollyConfig>): Promise<PollyConfig> {
    const newConfig = new this.pollyConfigModel({
      ...pollyConfig,
    });
    return newConfig.save();
  }

  async update(
    id: ObjectId,
    pollyConfig: Partial<PollyConfig>,
  ): Promise<PollyConfig | null> {
    return this.pollyConfigModel
      .findByIdAndUpdate(id, pollyConfig, { new: true })
      .exec();
  }
}
