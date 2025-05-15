import {
  Controller,
  Post,
  Body,
  HttpStatus,
  HttpException,
  Logger,
  BadRequestException,
  Res,
} from '@nestjs/common';
import { VideoService } from '../services/video.service';
import { CrearVideoDto } from '../dto/crear-video.dto';
import { AudioService } from 'src/ai-video-generation/audios/services/audio.service';
import { ImageService } from 'src/ai-video-generation/images/services/image.service';
import { VideoGenerationService } from '../services/video-generation.service';
import { Languages, Status, VideoType } from 'src/ai-video-generation/types';
import { Response } from 'express';
import { VideoTestService } from '../services/videotest.service';
import { VideoQueueService } from '../queues/video-queue.service';

@Controller('video-generation')
export class VideoGenerationController {
  private readonly logger = new Logger(VideoGenerationController.name);

  constructor(
    private readonly videoService: VideoService,
    private readonly imageService: ImageService,
    private readonly audioService: AudioService,
    private readonly videoGenerationService: VideoGenerationService,
    private readonly videoTestService: VideoTestService,
    private readonly videoQueueService: VideoQueueService,
  ) {}

  @Post()
  async crearVideo(@Body() crearVideoDto: CrearVideoDto) {
    if (
      !crearVideoDto.videoId ||
      !crearVideoDto.audios.length ||
      !crearVideoDto.images.length
    ) {
      throw new HttpException('Missing data!s', HttpStatus.BAD_REQUEST);
    }

    const images = await this.imageService.findByVideoId(crearVideoDto.videoId);
    const audios = await this.audioService.findByVideoId(crearVideoDto.videoId);

    if (!images || images.length === 0) {
      throw new HttpException(
        'No images found for the provided video ID',
        HttpStatus.NOT_FOUND,
      );
    }
    if (!audios || audios.length === 0) {
      throw new HttpException(
        'No audios found for the provided video ID',
        HttpStatus.NOT_FOUND,
      );
    }

    const chosenImages = images.filter((image) =>
      crearVideoDto.images.includes(image._id.toString()),
    );
    const chosenAudios = audios.filter((audio) =>
      crearVideoDto.audios.includes(audio._id.toString()),
    );

    this.videoGenerationService.crearVideo(
      crearVideoDto.videoId,
      chosenImages,
      chosenAudios,
      crearVideoDto.lang,
      {
        addToBeContinued: crearVideoDto.addToBeContinued,
        addTheEnd: crearVideoDto.addTheEnd,
      },
    );

    return {
      statusCode: HttpStatus.OK,
      message: 'Video generation tasks created successfully',
    };
  }

  @Post('video-buffer')
  async videoBuffer(
    @Body() crearVideoDto: CrearVideoDto,
    @Res() res: Response,
  ) {
    if (
      !crearVideoDto.videoId ||
      !crearVideoDto.audios.length ||
      !crearVideoDto.images.length
    ) {
      throw new HttpException('Missing data!', HttpStatus.BAD_REQUEST);
    }

    const images = await this.imageService.findByVideoId(crearVideoDto.videoId);
    const audios = await this.audioService.findByVideoId(crearVideoDto.videoId);

    if (!images || images.length === 0) {
      throw new HttpException(
        'No images found for the provided video ID',
        HttpStatus.NOT_FOUND,
      );
    }
    if (!audios || audios.length === 0) {
      throw new HttpException(
        'No audios found for the provided video ID',
        HttpStatus.NOT_FOUND,
      );
    }

    const chosenImages = images.filter((image) =>
      crearVideoDto.images.includes(image._id.toString()),
    );
    const chosenAudios = audios.filter((audio) =>
      crearVideoDto.audios.includes(audio._id.toString()),
    );

    const videoBuffer = await this.videoTestService.createBufferVideo(
      crearVideoDto.videoId,
      chosenImages,
      chosenAudios,
    );

    res.setHeader('Content-Type', 'video/mp4');
    res.send(videoBuffer);
  }

  @Post('generate-script')
  async generateScript(@Body() body: { type: VideoType; lang: Languages }) {
    if (!body.type) {
      throw new BadRequestException('Script type is required');
    }

    const validTypes = Object.values(VideoType);
    if (!validTypes.includes(body.type)) {
      throw new BadRequestException(
        `Invalid script type. Must be one of: ${validTypes.join(', ')}`,
      );
    }

    try {
      const script = await this.videoService.generateScript(
        body.type,
        body.lang,
      );

      return {
        statusCode: HttpStatus.OK,
        message: 'Script generated successfully',
        data: { script },
      };
    } catch (error) {
      this.logger.error(
        `Failed to generate script: ${error.message}`,
        error.stack,
      );
      throw new HttpException(
        `Failed to generate script: ${error.message}`,
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  @Post('generate-script-json')
  async generateScriptJson(
    @Body() body: { type: VideoType; text: string; lang: Languages },
  ) {
    if (!body.type) {
      throw new BadRequestException('Script type is required');
    }

    if (!body.text) {
      throw new BadRequestException('Text is required');
    }

    const validTypes = Object.values(VideoType);
    if (!validTypes.includes(body.type)) {
      throw new BadRequestException(
        `Invalid script type. Must be one of: ${validTypes.join(', ')}`,
      );
    }

    try {
      const script = await this.videoService.generateScriptJson(
        body.type,
        body.text,
        body.lang,
      );

      return {
        statusCode: HttpStatus.OK,
        message: 'JSON script generated successfully',
        data: { script },
      };
    } catch (error) {
      this.logger.error(
        `Failed to generate JSON script: ${error.message}`,
        error.stack,
      );
      throw new HttpException(
        `Failed to generate JSON script: ${error.message}`,
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  @Post('all-media')
  async crearVideoConTodo(
    @Body()
    body: {
      videoId: string;
    },
  ) {
    if (!body.videoId) {
      throw new HttpException('VideoId is required', HttpStatus.BAD_REQUEST);
    }

    const video = await this.videoService.findById(body.videoId);

    if (!video) {
      throw new HttpException('Video not found', HttpStatus.NOT_FOUND);
    }

    // Instead of directly processing, add to queue
    const jobId = await this.videoQueueService.addVideoProcessingJob(
      body.videoId,
    );

    await this.videoService.setStatus(body.videoId, Status.QUEUED);

    return {
      statusCode: HttpStatus.OK,
      message: 'Video added to processing queue successfully',
      jobId,
    };
  }

  @Post('process-incomplete-videos')
  async processIncompleteVideos() {
    // Find all videos that don't have url or publicId
    const incompleteVideos = await this.videoService.findIncompleteVideos();

    if (!incompleteVideos || incompleteVideos.length === 0) {
      return {
        statusCode: HttpStatus.OK,
        message: 'No incomplete videos found',
        count: 0,
      };
    }

    // Get the list of videoIds
    const videoIds = incompleteVideos.map((video) => video._id.toString());

    // Add them to the queue with delay between jobs
    const jobIds =
      await this.videoQueueService.addBatchVideoGenerationJobs(videoIds);

    return {
      statusCode: HttpStatus.OK,
      message: `Added ${videoIds.length} videos to processing queue`,
      count: videoIds.length,
      jobIds: jobIds,
    };
  }
}
