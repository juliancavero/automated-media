import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  Put,
  HttpStatus,
  HttpException,
  HttpCode,
} from '@nestjs/common';
import { VideosService } from './videos.service';
import { CreateVideoDto } from './dto/create-video.dto';
import { UpdateVideoDto } from './dto/update-video.dto';

@Controller('videos')
export class VideosController {
  constructor(private readonly videosService: VideosService) {}

  @Post()
  create(@Body() createVideoDto: CreateVideoDto) {
    return this.videosService.create(createVideoDto);
  }

  @Get()
  findAll() {
    return this.videosService.findAll();
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.videosService.findOne(id);
  }

  @Patch(':id')
  update(@Param('id') id: string, @Body() updateVideoDto: UpdateVideoDto) {
    return this.videosService.update(id, updateVideoDto);
  }

  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.videosService.remove(id);
  }

  @Post('generate-description')
  async generateDescription() {
    const updatedVideo =
      await this.videosService.generateDescriptionForRandomVideo();

    if (!updatedVideo) {
      throw new HttpException(
        'No videos found without description and not uploaded',
        HttpStatus.NOT_FOUND,
      );
    }

    return updatedVideo;
  }

  @Put(':id/mark-uploaded')
  @HttpCode(HttpStatus.OK)
  async markUploaded(@Param('id') id: string) {
    try {
      const updatedVideo = await this.videosService.update(id, {
        uploaded: true,
      });
      if (!updatedVideo) {
        throw new HttpException('Video not found', HttpStatus.NOT_FOUND);
      }
      return { message: 'Video marked as uploaded successfully' };
    } catch (error) {
      throw new HttpException(
        `Failed to mark video as uploaded: ${error.message}`,
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }
}
