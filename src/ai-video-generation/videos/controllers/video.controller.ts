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
  Put,
} from '@nestjs/common';
import { VideoGenerationService } from '../services/video-generation.service';
import { GenerateVideoDto } from '../dto/generate-video.dto';
import { ImageService } from 'src/ai-video-generation/images/services/image.service';
import { AudioService } from 'src/ai-video-generation/audios/services/audio.service';
import { VideoQueueService } from '../queues/video-queue.service';
import { ApiQuery } from '@nestjs/swagger';
import { Video } from '../entities/video.schema';
import { VideoService } from '../services/video.service';
import { getTargetLanguage, Languages } from 'src/ai-video-generation/types';

interface CalendarDay {
  day: number;
  date: Date;
  inCurrentMonth: boolean;
  isNewRow: boolean;
  videos: Video[];
}
@Controller('videos')
export class VideoController {
  private readonly logger = new Logger(VideoController.name);

  constructor(
    private readonly videoService: VideoService,
    private readonly imageService: ImageService,
    private readonly audioService: AudioService,
    private readonly videoQueueService: VideoQueueService,
  ) {}

  @Post('create-video-job')
  async generateVideo(@Body() generateVideoDto: GenerateVideoDto) {
    if (
      !generateVideoDto.texts ||
      generateVideoDto.texts.length === 0 ||
      !generateVideoDto.images ||
      generateVideoDto.images.length === 0
    ) {
      throw new HttpException(
        'Texts array cannot be empty',
        HttpStatus.BAD_REQUEST,
      );
    }

    this.logger.log('Generating video with texts:', generateVideoDto.texts);
    const result = await this.videoService.createVideoJob(generateVideoDto);

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
  async markVideoAsUploaded(
    @Param('id') id: string,
  ): Promise<{ success: boolean; message: string }> {
    try {
      const video = await this.videoService.setVideoUploaded(id);
      if (!video) {
        return { success: false, message: 'Video not found' };
      }
      return {
        success: true,
        message: 'Video marked as uploaded successfully',
      };
    } catch (error) {
      this.logger.error(`Error marking video as uploaded: ${error.message}`);
      return { success: false, message: `Error: ${error.message}` };
    }
  }

  @Post(':id/regenerate-description')
  async regenerateVideoDescription(
    @Param('id') id: string,
  ): Promise<{ success: boolean; message: string }> {
    try {
      const result = await this.videoService.regenerateVideoDescription(id);
      if (!result) {
        return {
          success: false,
          message: 'Video not found or description generation failed',
        };
      }
      return {
        success: true,
        message: 'Video description generated successfully',
      };
    } catch (error) {
      this.logger.error(
        `Error regenerating video description: ${error.message}`,
      );
      return { success: false, message: `Error: ${error.message}` };
    }
  }

  @Post(':id/generate-language-copy')
  async generateLanguageCopy(
    @Param('id') id: string,
    @Body() body: { lang: Languages },
  ): Promise<{ success: boolean; message: string; newVideoId?: string }> {
    const targetLanguage = getTargetLanguage(body.lang);
    try {
      const result = await this.videoService.generateLanguageCopy(
        id,
        targetLanguage,
      );
      if (!result) {
        return {
          success: false,
          message: 'Video not found or language copy generation failed',
        };
      }

      return {
        success: true,
        message: 'Video language copy generated successfully',
        newVideoId: result._id.toString(),
      };
    } catch (error) {
      this.logger.error(
        `Error generating video language copy: ${error.message}`,
      );
      return { success: false, message: `Error: ${error.message}` };
    }
  }

  @Post('relaunch-missing-descriptions')
  async relaunchMissingDescriptions(): Promise<{
    success: boolean;
    message: string;
    count: number;
  }> {
    try {
      const videos = await this.videoService.findVideosWithoutDescription();

      if (videos.length === 0) {
        return {
          success: true,
          message: 'No videos without descriptions found',
          count: 0,
        };
      }

      for (const video of videos) {
        await this.videoQueueService.addVideoDescriptionGenerationJob(
          video._id.toString(),
        );
      }

      return {
        success: true,
        message: `Queued description generation for ${videos.length} videos`,
        count: videos.length,
      };
    } catch (error) {
      this.logger.error(
        `Error relaunching missing descriptions: ${error.message}`,
      );
      return { success: false, message: `Error: ${error.message}`, count: 0 };
    }
  }

  @Delete(':id')
  async deleteVideo(
    @Param('id') id: string,
  ): Promise<{ success: boolean; message: string }> {
    try {
      await this.videoService.deleteVideo(id);
      return {
        success: true,
        message: 'Video and related resources deleted successfully',
      };
    } catch (error) {
      this.logger.error(`Error deleting video: ${error.message}`);
      return { success: false, message: `Error: ${error.message}` };
    }
  }

  @Put(':id/upload-date')
  async setVideoUploadDate(
    @Param('id') id: string,
    @Body() body: { uploadDate: string },
  ): Promise<{ success: boolean; message: string }> {
    try {
      const uploadDate = new Date(body.uploadDate);

      if (isNaN(uploadDate.getTime())) {
        return { success: false, message: 'Invalid date format' };
      }

      const video = await this.videoService.setVideoUploadDate(id, uploadDate);

      if (!video) {
        return { success: false, message: 'Video not found' };
      }

      return { success: true, message: 'Upload date set successfully' };
    } catch (error) {
      this.logger.error(`Error setting video upload date: ${error.message}`);
      return { success: false, message: `Error: ${error.message}` };
    }
  }

  @Get('available-for-date/:date')
  async getAvailableVideosForDate(@Param('date') dateStr: string) {
    try {
      // Parse date from dd-mm-yyyy format
      const [day, month, year] = dateStr
        .split('-')
        .map((num) => parseInt(num, 10));
      const date = new Date(year, month - 1, day);

      if (isNaN(date.getTime())) {
        throw new HttpException('Invalid date format', HttpStatus.BAD_REQUEST);
      }

      const videos = await this.videoService.findLatestVideosByType();

      return {
        success: true,
        date: dateStr,
        videos,
      };
    } catch (error) {
      this.logger.error(`Error getting available videos: ${error.message}`);
      return {
        success: false,
        message: `Error: ${error.message}`,
        videos: [],
      };
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
    name: 'series',
    type: String,
    description: 'Name of the series',
    required: false,
  })
  @ApiQuery({
    name: 'type',
    type: String,
    description: 'Type of video (basic, structured, real)',
    required: false,
  })
  @ApiQuery({
    name: 'status',
    type: String,
    description: 'Status of video (pending, finished, uploaded)',
    required: false,
  })
  @ApiQuery({
    name: 'page',
    type: Number,
    description: 'Page number',
    required: false,
  })
  @ApiQuery({
    name: 'limit',
    type: Number,
    description: 'Number of items per page',
    required: false,
  })
  @ApiQuery({
    name: 'notRelated',
    type: String,
    description: 'Filter videos not related to the series',
    required: false,
  })
  async renderVideoGenerationsList(
    @Query('series') series?: string,
    @Query('type') type?: string,
    @Query('status') status?: string,
    @Query('page') pageQuery?: string,
    @Query('limit') limitQuery?: string,
    @Query('lang') lang: Languages = Languages.EN,
    @Query('notRelated') notRelated?: string,
  ) {
    const page = pageQuery ? parseInt(pageQuery, 10) : 1;
    const limit = limitQuery ? parseInt(limitQuery, 10) : 10;

    const { videos, total, totalPages } = await this.videoService.findAll(
      series,
      type,
      status,
      page,
      limit,
      lang,
      notRelated === 'true',
    );

    return {
      title: 'Video Generations List',
      videoGenerations: videos,
      currentSeriesFilter: series || '',
      currentTypeFilter: type || '',
      currentStatusFilter: status || '',
      currentRelatedFilter: notRelated || '',
      lang,
      pagination: {
        currentPage: page,
        totalPages,
        totalItems: total,
        limit,
        hasNext: page < totalPages,
        hasPrev: page > 1,
        nextPage: page + 1,
        prevPage: page - 1,
      },
    };
  }

  @Get('list/:id')
  @Render('ai-video-generation/video-details')
  async renderVideoGenerationDetails(@Param('id') id: string) {
    const videoGeneration = await this.videoService.findOne(id);
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

  @Get('calendar')
  @Render('ai-video-generation/video-calendar')
  async renderVideoCalendar(
    @Query('month') monthParam?: string,
    @Query('year') yearParam?: string,
  ) {
    // Use current month/year if not provided
    const currentDate = new Date();
    const month = monthParam
      ? parseInt(monthParam, 10)
      : currentDate.getMonth() + 1; // JS months are 0-indexed
    const year = yearParam
      ? parseInt(yearParam, 10)
      : currentDate.getFullYear();

    // Get videos for the selected month
    const videos = await this.videoService.getVideosByUploadedAtMonth(
      month,
      year,
    );

    // Generate calendar data
    const calendarDays = this.generateCalendarDays(month, year, videos);

    // Calculate previous and next month
    const prevMonth =
      month === 1 ? { month: 12, year: year - 1 } : { month: month - 1, year };

    const nextMonth =
      month === 12 ? { month: 1, year: year + 1 } : { month: month + 1, year };

    // Get month name
    const monthName = new Date(year, month - 1, 1).toLocaleString('default', {
      month: 'long',
    });

    return {
      title: 'Video Calendar',
      videos,
      month,
      year,
      monthName,
      prevMonth,
      nextMonth,
      calendarDays,
    };
  }

  private generateCalendarDays(month: number, year: number, videos: Video[]) {
    const firstDay = new Date(year, month - 1, 1);
    const lastDay = new Date(year, month, 0);
    const daysInMonth = lastDay.getDate();
    const startingDayOfWeek = firstDay.getDay(); // 0 = Sunday, 1 = Monday, etc.

    // Calculate days from previous month to fill first row
    const prevMonthLastDay = new Date(year, month - 1, 0).getDate();
    const prevMonth = month === 1 ? 12 : month - 1;
    const prevMonthYear = month === 1 ? year - 1 : year;

    // Calculate days for next month to complete last row
    const nextMonth = month === 12 ? 1 : month + 1;
    const nextMonthYear = month === 12 ? year + 1 : year;

    // Define the type for calendar day objects

    const calendarDays: CalendarDay[] = [];

    // Add days from previous month
    for (let i = 0; i < startingDayOfWeek; i++) {
      const day = prevMonthLastDay - startingDayOfWeek + i + 1;
      calendarDays.push({
        day,
        date: new Date(prevMonthYear, prevMonth - 1, day),
        inCurrentMonth: false,
        isNewRow: i === 0 && calendarDays.length > 0,
        videos: [] as Video[],
      });
    }

    // Add days from current month with their videos
    for (let day = 1; day <= daysInMonth; day++) {
      const date = new Date(year, month - 1, day);

      // Filter videos for this day
      const dayVideos = videos.filter((video) => {
        if (!video.uploadedAt) return false;

        const videoDate = new Date(video.uploadedAt);
        return (
          videoDate.getDate() === day &&
          videoDate.getMonth() === month - 1 &&
          videoDate.getFullYear() === year
        );
      });

      calendarDays.push({
        day,
        date,
        inCurrentMonth: true,
        isNewRow: (startingDayOfWeek + day - 1) % 7 === 0 && day !== 1,
        videos: dayVideos,
      });
    }

    // Add days from next month to complete the last row
    const remainingDays = 7 - (calendarDays.length % 7);
    if (remainingDays < 7) {
      for (let day = 1; day <= remainingDays; day++) {
        calendarDays.push({
          day,
          date: new Date(nextMonthYear, nextMonth - 1, day),
          inCurrentMonth: false,
          isNewRow: false,
          videos: [] as Video[],
        });
      }
    }

    return calendarDays;
  }
}
