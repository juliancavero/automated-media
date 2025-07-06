import { Controller, Post, Body, Logger } from '@nestjs/common';
import { QuizzAiService } from './quizz-ai.service';
import {
  GenerateQuizTitleDto,
  GenerateQuestionDto,
  GenerateMultipleQuestionsDto,
  GenerateScoresDto,
  QuizQuestion,
} from './types';

@Controller('quizzes/ai')
export class QuizzAiController {
  private readonly logger = new Logger(QuizzAiController.name);

  constructor(private readonly quizzAiService: QuizzAiService) {}

  @Post('generate-title')
  async generateTitle(
    @Body() dto: GenerateQuizTitleDto,
  ): Promise<{ title: string }> {
    this.logger.log('Generating quiz title via API');

    try {
      const title = await this.quizzAiService.generateQuizTitle(dto);
      return { title };
    } catch (error) {
      this.logger.error(`Error in generateTitle endpoint: ${error.message}`);
      throw error;
    }
  }

  @Post('generate-question')
  async generateQuestion(
    @Body() dto: GenerateQuestionDto,
  ): Promise<QuizQuestion> {
    this.logger.log(`Generating question for title: ${dto.title}`);

    try {
      const question = await this.quizzAiService.generateQuestion(dto);
      return question;
    } catch (error) {
      this.logger.error(`Error in generateQuestion endpoint: ${error.message}`);
      throw error;
    }
  }

  @Post('generate-multiple-questions')
  async generateMultipleQuestions(
    @Body() dto: GenerateMultipleQuestionsDto,
  ): Promise<QuizQuestion[]> {
    this.logger.log(`Generating multiple questions for title: ${dto.title}`);

    try {
      const questions =
        await this.quizzAiService.generateMultipleQuestions(dto);
      return questions;
    } catch (error) {
      this.logger.error(
        `Error in generateMultipleQuestions endpoint: ${error.message}`,
      );
      throw error;
    }
  }

  @Post('generate-scores')
  async generateScores(
    @Body() dto: GenerateScoresDto,
  ): Promise<{ scores: string[] }> {
    this.logger.log(`Generating scores for title: ${dto.title}`);

    try {
      const scores = await this.quizzAiService.generateScores(dto);
      return { scores };
    } catch (error) {
      this.logger.error(`Error in generateScores endpoint: ${error.message}`);
      throw error;
    }
  }
}
