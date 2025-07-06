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
} from '@nestjs/common';
import { QuizzTestService } from './quizztest.service';
import { CreateQuizzTestDto } from './dto/create-quizztest.dto';
import { UpdateQuizzTestDto } from './dto/update-quizztest.dto';
import { PuppeteerService } from '../puppeteer/puppeteer.service';

@Controller('quizzes')
export class QuizzTestController {
  constructor(
    private readonly quizzTestService: QuizzTestService,
    private readonly puppeteerService: PuppeteerService,
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
    return { quizzes };
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
      message: 'Quiz video recorded successfully',
    };
  }

  @Post(':id/record-mp4')
  async recordAndConvertQuizVideo(
    @Param('id') id: string,
    @Body() body: { baseUrl?: string } = {},
  ) {
    const result = await this.puppeteerService.recordAndConvertQuizById(
      id,
      body.baseUrl,
    );
    return {
      success: true,
      ...result,
      message: 'Quiz video recorded and converted to MP4 successfully',
    };
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
