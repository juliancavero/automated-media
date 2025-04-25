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
import { VideoQueueService } from '../queues/video-queue.service';
import { ApiQuery } from '@nestjs/swagger';

@Controller('videos')
export class VideoController {
  private readonly logger = new Logger(VideoController.name);

  constructor(
    private readonly videoGenerationService: VideoGenerationService,
    private readonly imageService: ImageService,
    private readonly audioService: AudioService,
    private readonly videoQueueService: VideoQueueService,
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

    // Ensure type is one of the allowed values, default to 'basic'
    if (!generateVideoDto.type || !['basic', 'structured', 'real'].includes(generateVideoDto.type)) {
      generateVideoDto.type = 'basic';
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

  @Post('relaunch-missing-descriptions')
  async relaunchMissingDescriptions(): Promise<{ success: boolean; message: string; count: number }> {
    try {
      const videos = await this.videoGenerationService.findVideosWithoutDescription();

      if (videos.length === 0) {
        return { success: true, message: 'No videos without descriptions found', count: 0 };
      }

      for (const video of videos) {
        await this.videoQueueService.addVideoDescriptionGenerationJob(video._id.toString());
      }

      return {
        success: true,
        message: `Queued description generation for ${videos.length} videos`,
        count: videos.length
      };
    } catch (error) {
      this.logger.error(`Error relaunching missing descriptions: ${error.message}`);
      return { success: false, message: `Error: ${error.message}`, count: 0 };
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
  @ApiQuery({
    name: "series",
    type: String,
    description: "Name of the series",
    required: false
  })
  @ApiQuery({
    name: "type",
    type: String,
    description: "Type of video (basic, structured, real)",
    required: false
  })
  @ApiQuery({
    name: "page",
    type: Number,
    description: "Page number",
    required: false
  })
  @ApiQuery({
    name: "limit",
    type: Number,
    description: "Number of items per page",
    required: false
  })
  async renderVideoGenerationsList(
    @Query('series') series?: string,
    @Query('type') type?: string,
    @Query('page') pageQuery?: string,
    @Query('limit') limitQuery?: string,
  ) {
    const page = pageQuery ? parseInt(pageQuery, 10) : 1;
    const limit = limitQuery ? parseInt(limitQuery, 10) : 10;

    const { videos, total, totalPages } = await this.videoGenerationService.findAll(series, type, page, limit);

    return {
      title: 'Video Generations List',
      videoGenerations: videos,
      currentSeriesFilter: series || '',
      currentTypeFilter: type || '',
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
