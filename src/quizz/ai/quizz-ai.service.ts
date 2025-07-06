import { Injectable, Logger, UnauthorizedException } from '@nestjs/common';
import { GoogleGenerativeAI } from '@google/generative-ai';
import {
  QUIZ_TITLE_PROMPT,
  QUIZ_QUESTION_PROMPT,
  QUIZ_MULTIPLE_QUESTIONS_PROMPT,
  QUIZ_SCORES_PROMPT,
} from './prompts';
import {
  GenerateQuizTitleDto,
  GenerateQuestionDto,
  GenerateMultipleQuestionsDto,
  GenerateScoresDto,
  QuizQuestion,
} from './types';

@Injectable()
export class QuizzAiService {
  private readonly logger = new Logger(QuizzAiService.name);
  private readonly ai: GoogleGenerativeAI;

  constructor() {
    const apiKey = process.env.GOOGLE_AI_API_KEY;
    if (!apiKey) {
      this.logger.error(
        'GOOGLE_AI_API_KEY not set. AI functionality will not work.',
      );
    }
    this.ai = new GoogleGenerativeAI(apiKey ?? '');
  }

  async generateQuizTitle(dto: GenerateQuizTitleDto): Promise<string> {
    this.logger.log('Generating quiz title with AI');

    if (!process.env.GOOGLE_AI_API_KEY) {
      throw new UnauthorizedException('GOOGLE_AI_API_KEY is not set');
    }

    try {
      const model = this.ai.getGenerativeModel({ model: 'gemini-2.0-flash' });
      const result = await model.generateContent(QUIZ_TITLE_PROMPT);

      const title = result.response.text().trim();
      if (!title) {
        throw new Error('Could not generate quiz title');
      }

      this.logger.log('Quiz title generated successfully');
      return title;
    } catch (error) {
      this.logger.error(
        `Error generating quiz title: ${error.message}`,
        error.stack,
      );
      throw error;
    }
  }

  async generateQuestion(dto: GenerateQuestionDto): Promise<QuizQuestion> {
    this.logger.log(`Generating question for title: ${dto.title}`);

    if (!process.env.GOOGLE_AI_API_KEY) {
      throw new UnauthorizedException('GOOGLE_AI_API_KEY is not set');
    }

    try {
      const model = this.ai.getGenerativeModel({ model: 'gemini-2.0-flash' });

      const prompt = QUIZ_QUESTION_PROMPT.replace(
        '{{title}}',
        dto.title,
      ).replace('{{difficulty}}', dto.difficulty ?? 'fácil');

      const result = await model.generateContent(prompt);
      let responseText = result.response.text().trim();

      if (!responseText) {
        throw new Error('Could not generate question');
      }

      // Extract JSON from response
      const firstBrace = responseText.indexOf('{');
      const lastBrace = responseText.lastIndexOf('}');

      if (firstBrace !== -1 && lastBrace !== -1 && firstBrace < lastBrace) {
        responseText = responseText.substring(firstBrace, lastBrace + 1);
      }

      const question: QuizQuestion = JSON.parse(responseText);

      // Validate the response structure
      if (
        !question.texto ||
        !Array.isArray(question.respuestas) ||
        question.respuestas.length !== 4 ||
        typeof question.indiceRespuestaCorrecta !== 'number'
      ) {
        throw new Error('Invalid question format from AI');
      }

      this.logger.log('Question generated successfully');
      return question;
    } catch (error) {
      this.logger.error(
        `Error generating question: ${error.message}`,
        error.stack,
      );
      throw error;
    }
  }

  async generateMultipleQuestions(
    dto: GenerateMultipleQuestionsDto,
  ): Promise<QuizQuestion[]> {
    this.logger.log(`Generating 5 questions for title: ${dto.title}`);

    if (!process.env.GOOGLE_AI_API_KEY) {
      throw new UnauthorizedException('GOOGLE_AI_API_KEY is not set');
    }

    try {
      const model = this.ai.getGenerativeModel({ model: 'gemini-2.0-flash' });

      const prompt = QUIZ_MULTIPLE_QUESTIONS_PROMPT.replace(
        '{{title}}',
        dto.title,
      ).replace('{{difficulty}}', dto.difficulty ?? 'fácil');

      const result = await model.generateContent(prompt);
      let responseText = result.response.text().trim();

      if (!responseText) {
        throw new Error('Could not generate questions');
      }

      // Extract JSON array from response
      const firstBracket = responseText.indexOf('[');
      const lastBracket = responseText.lastIndexOf(']');

      if (
        firstBracket !== -1 &&
        lastBracket !== -1 &&
        firstBracket < lastBracket
      ) {
        responseText = responseText.substring(firstBracket, lastBracket + 1);
      }

      const questions: QuizQuestion[] = JSON.parse(responseText);

      // Validate the response structure
      if (!Array.isArray(questions) || questions.length !== 5) {
        throw new Error('AI should return exactly 5 questions');
      }

      questions.forEach((question, index) => {
        if (
          !question.texto ||
          !Array.isArray(question.respuestas) ||
          question.respuestas.length !== 4 ||
          typeof question.indiceRespuestaCorrecta !== 'number'
        ) {
          throw new Error(`Invalid question format at index ${index}`);
        }
      });

      this.logger.log('Multiple questions generated successfully');
      return questions;
    } catch (error) {
      this.logger.error(
        `Error generating multiple questions: ${error.message}`,
        error.stack,
      );
      throw error;
    }
  }

  async generateScores(dto: GenerateScoresDto): Promise<string[]> {
    this.logger.log(`Generating scores for title: ${dto.title}`);

    if (!process.env.GOOGLE_AI_API_KEY) {
      throw new UnauthorizedException('GOOGLE_AI_API_KEY is not set');
    }

    try {
      const model = this.ai.getGenerativeModel({ model: 'gemini-2.0-flash' });

      const prompt = QUIZ_SCORES_PROMPT.replace('{{title}}', dto.title);

      const result = await model.generateContent(prompt);
      let responseText = result.response.text().trim();

      if (!responseText) {
        throw new Error('Could not generate scores');
      }

      // Extract JSON from response
      const firstBrace = responseText.indexOf('{');
      const lastBrace = responseText.lastIndexOf('}');

      if (firstBrace !== -1 && lastBrace !== -1 && firstBrace < lastBrace) {
        responseText = responseText.substring(firstBrace, lastBrace + 1);
      }

      const scoresResponse: { scores: string[] } = JSON.parse(responseText);

      // Validate the response structure
      if (
        !scoresResponse.scores ||
        !Array.isArray(scoresResponse.scores) ||
        scoresResponse.scores.length !== 3
      ) {
        throw new Error('AI should return exactly 3 score levels');
      }

      this.logger.log('Scores generated successfully');
      return scoresResponse.scores;
    } catch (error) {
      this.logger.error(
        `Error generating scores: ${error.message}`,
        error.stack,
      );
      throw error;
    }
  }
}
