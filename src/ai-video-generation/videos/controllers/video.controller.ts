import {
  Controller,
  Post,
  Body,
  HttpStatus,
  HttpException,
  Logger,
  Get,
  Render,
  Param,
  Query,
  Delete,
} from '@nestjs/common';
import { VideoGenerationService } from '../services/video-generation.service';
import { GenerateVideoDto } from '../dto/generate-video.dto';
import { ImageService } from 'src/ai-video-generation/images/services/image.service';
import { AudioService } from 'src/ai-video-generation/audios/services/audio.service';

@Controller('videos')
export class VideoController {
  private readonly logger = new Logger(VideoController.name);

  constructor(
    private readonly videoGenerationService: VideoGenerationService,
    private readonly imageService: ImageService,
    private readonly audioService: AudioService,
  ) { }

  @Post('create-video-job')
  async generateVideo(@Body() generateVideoDto: GenerateVideoDto) {
    if (!generateVideoDto.texts
      || generateVideoDto.texts.length === 0
      || !generateVideoDto.images || generateVideoDto.images.length === 0) {
      throw new HttpException(
        'Texts array cannot be empty',
        HttpStatus.BAD_REQUEST,
      );
    }

    this.logger.log('Generating video with texts:', generateVideoDto.texts);
    const result =
      await this.videoGenerationService.createVideoJob(generateVideoDto);

    if (!result) {
      throw new HttpException(
        'Failed to process video generation request',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }

    return {
      statusCode: HttpStatus.OK,
      message: 'Video generation tasks created successfully',
    };
  }

  @Post(':id/mark-uploaded')
  async markVideoAsUploaded(@Param('id') id: string): Promise<{ success: boolean; message: string }> {
    try {
      const video = await this.videoGenerationService.setVideoUploaded(id);
      if (!video) {
        return { success: false, message: 'Video not found' };
      }
      return { success: true, message: 'Video marked as uploaded successfully' };
    } catch (error) {
      this.logger.error(`Error marking video as uploaded: ${error.message}`);
      return { success: false, message: `Error: ${error.message}` };
    }
  }

  @Post(':id/regenerate-description')
  async regenerateVideoDescription(@Param('id') id: string): Promise<{ success: boolean; message: string }> {
    try {
      const result = await this.videoGenerationService.regenerateVideoDescription(id);
      if (!result) {
        return { success: false, message: 'Video not found or description generation failed' };
      }
      return { success: true, message: 'Video description generated successfully' };
    } catch (error) {
      this.logger.error(`Error regenerating video description: ${error.message}`);
      return { success: false, message: `Error: ${error.message}` };
    }
  }

  @Delete(':id')
  async deleteVideo(@Param('id') id: string): Promise<{ success: boolean; message: string }> {
    try {
      await this.videoGenerationService.deleteVideo(id);
      return { success: true, message: 'Video and related resources deleted successfully' };
    } catch (error) {
      this.logger.error(`Error deleting video: ${error.message}`);
      return { success: false, message: `Error: ${error.message}` };
    }
  }

  // Views
  @Get('create')
  @Render('ai-video-generation/video-generation')
  async renderVideoGenerationPage() {
    return {
      title: 'AI Video Generation',
    };
  }

  @Get('list')
  @Render('ai-video-generation/video-list')
  async renderVideoGenerationsList(
    @Query('series') series?: string,
    @Query('page') pageQuery?: string,
    @Query('limit') limitQuery?: string,
  ) {
    const page = pageQuery ? parseInt(pageQuery, 10) : 1;
    const limit = limitQuery ? parseInt(limitQuery, 10) : 10;

    const { videos, total, totalPages } = await this.videoGenerationService.findAll(series, page, limit);

    return {
      title: 'Video Generations List',
      videoGenerations: videos,
      currentSeriesFilter: series || '',
      pagination: {
        currentPage: page,
        totalPages,
        totalItems: total,
        limit,
        hasNext: page < totalPages,
        hasPrev: page > 1,
        nextPage: page + 1,
        prevPage: page - 1,
      }
    };
  }

  @Get('list/:id')
  @Render('ai-video-generation/video-details')
  async renderVideoGenerationDetails(@Param('id') id: string) {
    const videoGeneration = await this.videoGenerationService.findOne(id);
    const images = await this.imageService.findByVideoId(id);
    const audio = await this.audioService.findByVideoId(id);

    if (!videoGeneration) {
      throw new HttpException(
        'Video generation not found',
        HttpStatus.NOT_FOUND,
      );
    }

    return {
      title: 'Video Generation Details',
      videoGeneration,
      images,
      audio,
    };
  }
}
