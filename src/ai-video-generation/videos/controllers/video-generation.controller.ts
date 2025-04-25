import {
  Controller,
  Post,
  Body,
  HttpStatus,
  HttpException,
  Logger,
} from '@nestjs/common';
import { VideoService } from '../services/video.service';
import { CrearVideoDto } from '../dto/crear-video.dto';
import { AudioService } from 'src/ai-video-generation/audios/services/audio.service';
import { ImageService } from 'src/ai-video-generation/images/services/image.service';

@Controller('video-generation')
export class VideoGenerationController {
  private readonly logger = new Logger(VideoGenerationController.name);

  constructor(
    private readonly videoService: VideoService,
    private readonly imageService: ImageService,
    private readonly audioService: AudioService,
  ) { }

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

    this.videoService.crearVideo(
      crearVideoDto.videoId,
      chosenImages,
      chosenAudios,
      {
        addToBeContinued: crearVideoDto.addToBeContinued,
        addTheEnd: crearVideoDto.addTheEnd,
      }
    );

    return {
      statusCode: HttpStatus.OK,
      message: 'Video generation tasks created successfully',
    };
  }
}
