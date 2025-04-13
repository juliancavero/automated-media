import {
  Controller,
  Post,
  Body,
  Get,
  Param,
  HttpException,
  HttpStatus,
} from '@nestjs/common';
import { QueueService } from './queue.service';

@Controller('queue')
export class QueueController {
  constructor(private readonly queueService: QueueService) {}

  @Post('process-video')
  async processVideo(@Body() data: any) {
    try {
      const jobId = await this.queueService.addToQueue('process-video', data);
      return { jobId, message: 'Video processing job added to queue' };
    } catch (error) {
      throw new HttpException(
        `Failed to add video processing job: ${error.message}`,
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  @Post('process-audio')
  async processAudio(@Body() data: any) {
    try {
      const jobId = await this.queueService.addToQueue('process-audio', data);
      return { jobId, message: 'Audio processing job added to queue' };
    } catch (error) {
      throw new HttpException(
        `Failed to add audio processing job: ${error.message}`,
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  @Post('process-image')
  async processImage(@Body() data: any) {
    try {
      const jobId = await this.queueService.addToQueue('process-image', data);
      return { jobId, message: 'Image processing job added to queue' };
    } catch (error) {
      throw new HttpException(
        `Failed to add image processing job: ${error.message}`,
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  @Get('job/:id')
  async getJobStatus(@Param('id') jobId: string) {
    try {
      return await this.queueService.getJobStatus(jobId);
    } catch (error) {
      throw new HttpException(
        `Failed to get job status: ${error.message}`,
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }
}
