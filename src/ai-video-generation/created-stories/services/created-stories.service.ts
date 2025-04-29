import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { CreatedStory } from '../schemas/created-story.schema';
import { VideoType } from '../../types';

@Injectable()
export class CreatedStoriesService {
  constructor(
    @InjectModel(CreatedStory.name)
    private readonly createdStoryModel: Model<CreatedStory>,
  ) {}

  async findByType(type: VideoType): Promise<CreatedStory | null> {
    return this.createdStoryModel.findOne({ type }).exec();
  }

  async saveOrUpdate(type: VideoType, titles: string[]): Promise<CreatedStory> {
    const existingStory = await this.createdStoryModel.findOne({ type }).exec();

    if (existingStory) {
      existingStory.titles = titles;
      return existingStory.save();
    } else {
      const newStory = new this.createdStoryModel({
        type,
        titles,
      });
      return newStory.save();
    }
  }

  async getAllTypes(): Promise<VideoType[]> {
    return Object.values(VideoType);
  }
}
