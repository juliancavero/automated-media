import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  Put,
  Delete,
  HttpCode,
  HttpStatus,
  Render,
  UseInterceptors,
  UploadedFile,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { diskStorage } from 'multer';
import { extname } from 'path';
import * as fs from 'fs';
import { QuizzTestService } from './quizztest.service';
import { CreateQuizzTestDto } from './dto/create-quizztest.dto';
import { UpdateQuizzTestDto } from './dto/update-quizztest.dto';
import { PuppeteerService } from '../puppeteer/puppeteer.service';
import { FFmpegConverterService } from '../helpers/ffmpeg-converter';
import { Public } from 'src/auth/decorators/public.decorator';

@Controller('quizzes')
export class QuizzTestController {
  constructor(
    private readonly quizzTestService: QuizzTestService,
    private readonly puppeteerService: PuppeteerService,
    private readonly ffmpegConverter: FFmpegConverterService,
  ) {}

  @Post()
  create(@Body() createQuizzTestDto: CreateQuizzTestDto) {
    return this.quizzTestService.create(createQuizzTestDto);
  }

  @Get()
  findAll() {
    return this.quizzTestService.findAll();
  }

  @Get('list')
  @Render('quizz/quiz-list')
  async showList() {
    const quizzes = await this.quizzTestService.findAll();
    return { quizzes, frontUrl: process.env.QUIZZ_FRONT_URL || '' };
  }

  @Get('create')
  @Render('quizz/create-quiz')
  showCreateForm() {
    return {};
  }

  @Post('create-with-questions')
  async createWithQuestions(@Body() createQuizzWithQuestionsDto: any) {
    return this.quizzTestService.createWithQuestions(
      createQuizzWithQuestionsDto,
    );
  }

  @Public()
  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.quizzTestService.findOne(id);
  }

  @Put(':id')
  update(
    @Param('id') id: string,
    @Body() updateQuizzTestDto: UpdateQuizzTestDto,
  ) {
    return this.quizzTestService.update(id, updateQuizzTestDto);
  }

  @Put(':id/with-questions')
  updateWithQuestions(
    @Param('id') id: string,
    @Body() updateQuizzWithQuestionsDto: any,
  ) {
    return this.quizzTestService.updateWithQuestions(
      id,
      updateQuizzWithQuestionsDto,
    );
  }

  @Get(':id/edit')
  @Render('quizz/edit-quiz')
  async showEditForm(@Param('id') id: string) {
    const quizzTest = await this.quizzTestService.findOne(id);
    return { quizzTest };
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  remove(@Param('id') id: string) {
    return this.quizzTestService.remove(id);
  }

  @Get(':id/render')
  @Render('quizz/quizztest')
  async render(@Param('id') id: string) {
    const quizzTest = await this.quizzTestService.findOne(id);
    return { quizzTest };
  }

  @Post(':id/record')
  async recordQuizVideo(
    @Param('id') id: string,
    @Body() body: { baseUrl?: string } = {},
  ) {
    const videoPath = await this.puppeteerService.recordQuizById(
      id,
      body.baseUrl,
    );
    return {
      success: true,
      videoPath,
      message:
        'Quiz video recorded successfully with Puppeteer Screen Recorder',
    };
  }

  @Post(':id/video')
  @UseInterceptors(
    FileInterceptor('video', {
      storage: diskStorage({
        destination: '/tmp/uploads',
        filename: (req, file, cb) => {
          const uniqueSuffix =
            Date.now() + '-' + Math.round(Math.random() * 1e9);
          const ext = extname(file.originalname);
          cb(null, `temp-quiz-${req.params.id}-${uniqueSuffix}${ext}`);
        },
      }),
      fileFilter: (req, file, cb) => {
        if (file.mimetype.startsWith('video/')) {
          cb(null, true);
        } else {
          cb(new Error('Only video files are allowed'), false);
        }
      },
    }),
  )
  async uploadVideo(
    @Param('id') id: string,
    @UploadedFile() file: Express.Multer.File,
  ) {
    if (!file) {
      throw new Error('No video file provided');
    }

    console.log('Processing uploaded video file:', file);

    const finalOutputPath = `/home/julian/Escritorio/personal/automated-media/public/videos/quiz-${id}-${Date.now()}.mp4`;

    try {
      // Convert webm to mp4 with maximum quality
      await this.ffmpegConverter.keep500x869SizeHighQuality(
        file.path,
        finalOutputPath,
      );

      // Clean up temporary file
      if (fs.existsSync(file.path)) {
        fs.unlinkSync(file.path);
      }

      return {
        success: true,
        message: 'Video uploaded and converted to MP4 with maximum quality',
        filename: finalOutputPath.split('/').pop(),
        path: finalOutputPath,
        originalSize: file.size,
      };
    } catch (error) {
      // Clean up temporary file on error
      if (fs.existsSync(file.path)) {
        fs.unlinkSync(file.path);
      }
      throw new Error(`Video conversion failed: ${error.message}`);
    }
  }

  @Post(':id/scores')
  async addScore(@Param('id') id: string, @Body() body: { score: string }) {
    return this.quizzTestService.addScore(id, body.score);
  }

  @Delete(':id/scores')
  async removeScore(@Param('id') id: string, @Body() body: { score: string }) {
    return this.quizzTestService.removeScore(id, body.score);
  }
}
