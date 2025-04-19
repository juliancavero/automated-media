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
  ) {}

  @Post('create-video-job')
  async generateVideo(@Body() generateVideoDto: GenerateVideoDto) {
    if (!generateVideoDto.texts || generateVideoDto.texts.length === 0) {
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
  async renderVideoGenerationsList() {
    const videoGenerations = await this.videoGenerationService.findAll();
    return {
      title: 'Video Generations List',
      videoGenerations,
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
