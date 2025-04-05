import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  Delete,
  Put,
  HttpStatus,
  HttpException,
  HttpCode,
  UseInterceptors,
  UploadedFile,
  NotFoundException,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { VideosService } from './videos.service';
import { CreateVideoDto } from './dto/create-video.dto';
import { CloudinaryService } from '../cloudinary/cloudinary.service';

@Controller('videos')
export class VideosController {
  constructor(
    private readonly videosService: VideosService,
    private readonly cloudinaryService: CloudinaryService,
  ) {}

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

  @Delete(':id')
  @HttpCode(HttpStatus.OK)
  async remove(@Param('id') id: string) {
    try {
      // This will now delete from both Cloudinary and the database
      await this.videosService.remove(id);
      return {
        message: 'Video deleted successfully from both database and Cloudinary',
      };
    } catch (error) {
      if (error instanceof NotFoundException) {
        throw new HttpException(error.message, HttpStatus.NOT_FOUND);
      }
      throw new HttpException(
        `Failed to delete video: ${error.message}`,
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
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
      await this.videosService.markAsUploaded(id);
      return { message: 'Video marked as uploaded successfully' };
    } catch (error) {
      if (error instanceof NotFoundException) {
        throw new HttpException(error.message, HttpStatus.NOT_FOUND);
      }
      throw new HttpException(
        `Failed to mark video as uploaded: ${error.message}`,
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  @Post('upload')
  @UseInterceptors(FileInterceptor('file'))
  async uploadVideo(@UploadedFile() file: Express.Multer.File) {
    try {
      if (!file) {
        throw new HttpException('No file uploaded', HttpStatus.BAD_REQUEST);
      }

      const result = await this.cloudinaryService.uploadFile(file);

      // Create a new video entry with the Cloudinary URL and publicId
      const createVideoDto: CreateVideoDto = {
        url: result.url,
        publicId: result.public_id,
      };

      await this.videosService.create(createVideoDto);

      return {
        message: 'Video uploaded successfully',
        url: result.url,
        public_id: result.public_id,
      };
    } catch (error) {
      throw new HttpException(
        `Failed to upload video: ${error.message}`,
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }
}
