import {
  Controller,
  Post,
  Body,
  HttpStatus,
  HttpException,
  Logger,
  Get,
  Render,
} from '@nestjs/common';
import { VideoGenerationService } from './video-generation.service';
import { GenerateVideoDto } from './dto/generate-video.dto';

@Controller('generate-video')
export class VideoGenerationController {
  private readonly logger = new Logger(VideoGenerationController.name);

  constructor(
    private readonly videoGenerationService: VideoGenerationService,
  ) {}

  @Get()
  @Render('video-generation')
  async renderVideoGenerationPage() {
    return {
      title: 'AI Video Generation',
    };
  }

  @Get('all')
  @Render('video-generations-list')
  async renderVideoGenerationsList() {
    try {
      this.logger.log('Rendering video generations list');
      const videoGenerations = await this.videoGenerationService.findAll();

      this.logger.log(`Found ${videoGenerations.length} video generations`);
      return {
        title: 'Video Generations List',
        videoGenerations,
      };
    } catch (error) {
      this.logger.error(
        `Error rendering video generations list: ${error.message}`,
        error.stack,
      );

      return {
        title: 'Video Generations List',
        videoGenerations: [],
        error: `Failed to load video generations: ${error.message}`,
      };
    }
  }

  @Get('list')
  async listVideoGenerations() {
    try {
      this.logger.log('Listing all video generations');
      const videoGenerations = await this.videoGenerationService.findAll();

      return {
        statusCode: HttpStatus.OK,
        message: 'Video generations retrieved successfully',
        data: videoGenerations,
      };
    } catch (error) {
      this.logger.error(
        `Error listing video generations: ${error.message}`,
        error.stack,
      );

      throw new HttpException(
        `Failed to list video generations: ${error.message}`,
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  @Post()
  async generateVideo(@Body() generateVideoDto: GenerateVideoDto) {
    this.logger.log('Received request to generate video');

    try {
      if (!generateVideoDto.texts || generateVideoDto.texts.length === 0) {
        throw new HttpException(
          'Texts array cannot be empty',
          HttpStatus.BAD_REQUEST,
        );
      }

      const result =
        await this.videoGenerationService.generateVideo(generateVideoDto);

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
    } catch (error) {
      this.logger.error(
        `Error in video generation endpoint: ${error.message}`,
        error.stack,
      );

      if (error instanceof HttpException) {
        throw error;
      }

      throw new HttpException(
        `Failed to generate video: ${error.message}`,
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }
}
