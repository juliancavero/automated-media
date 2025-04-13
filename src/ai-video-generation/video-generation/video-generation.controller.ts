import {
  Controller,
  Post,
  Body,
  HttpStatus,
  HttpException,
  Logger,
} from '@nestjs/common';
import { VideoGenerationService } from './video-generation.service';
import { GenerateVideoDto } from './dto/generate-video.dto';

@Controller('generate-video')
export class VideoGenerationController {
  private readonly logger = new Logger(VideoGenerationController.name);

  constructor(
    private readonly videoGenerationService: VideoGenerationService,
  ) {}

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
