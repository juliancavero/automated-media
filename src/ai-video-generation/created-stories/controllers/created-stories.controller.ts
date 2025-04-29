import {
  Controller,
  Get,
  Put,
  Body,
  Query,
  BadRequestException,
} from '@nestjs/common';
import { CreatedStoriesService } from '../services/created-stories.service';
import { VideoType } from '../../types';

@Controller('created-stories')
export class CreatedStoriesController {
  constructor(private readonly createdStoriesService: CreatedStoriesService) {}

  @Get()
  async getByType(@Query('type') type: string) {
    if (!type || !Object.values(VideoType).includes(type as VideoType)) {
      throw new BadRequestException('Valid type is required');
    }

    const story = await this.createdStoriesService.findByType(
      type as VideoType,
    );
    return story || { type, titles: [] };
  }

  @Get('types')
  async getAllTypes() {
    return { types: await this.createdStoriesService.getAllTypes() };
  }

  @Put()
  async updateStory(
    @Body('type') type: string,
    @Body('titles') titles: string[],
  ) {
    if (!type || !Object.values(VideoType).includes(type as VideoType)) {
      throw new BadRequestException('Valid type is required');
    }

    if (!Array.isArray(titles)) {
      throw new BadRequestException('Titles must be an array of strings');
    }

    const updatedStory = await this.createdStoriesService.saveOrUpdate(
      type as VideoType,
      titles,
    );

    return {
      success: true,
      message: 'Story updated successfully',
      data: updatedStory,
    };
  }
}
