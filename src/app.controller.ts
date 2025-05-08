import { Controller, Get, Render, Res } from '@nestjs/common';
import { Response } from 'express';
import { readFileSync } from 'fs';
import { join } from 'path';
import { Public } from './auth/decorators/public.decorator';

const files = {
  basic_story_step1: 'basic_story_step1.txt',
  basic_story_step2: 'basic_story_step2.txt',
  hidden_beasts_step1: 'hidden_beasts_step1.txt',
  hidden_beasts_step2: 'hidden_beasts_step2.txt',
  hidden_files_step1: 'hidden_files_step1.txt',
  hidden_files_step2: 'hidden_files_step2.txt',
  real_stories_step1: 'real_stories_step1.txt',
  real_stories_step2: 'real_stories_step2.txt',
  structured_story_step1: 'structured_story_step1.txt',
  structured_story_step2: 'structured_story_step2.txt',
};

@Controller('')
export class AppController {
  constructor() {}

  @Public()
  @Get()
  async redirectToVideosList(@Res() res: Response) {
    return res.redirect('/videos/calendar?lang=en');
  }

  @Get('templates')
  async getTemplates(@Res() res: Response) {
    try {
      const templatesPath = join(process.cwd(), 'public', 'templates');

      const basic_story_step1 = readFileSync(
        join(templatesPath, files.basic_story_step1),
        'utf-8',
      );
      const basic_story_step2 = readFileSync(
        join(templatesPath, files.basic_story_step2),
        'utf-8',
      );
      const hidden_beasts_step1 = readFileSync(
        join(templatesPath, files.hidden_beasts_step1),
        'utf-8',
      );
      const hidden_beasts_step2 = readFileSync(
        join(templatesPath, files.hidden_beasts_step2),
        'utf-8',
      );
      const hidden_files_step1 = readFileSync(
        join(templatesPath, files.hidden_files_step1),
        'utf-8',
      );
      const hidden_files_step2 = readFileSync(
        join(templatesPath, files.hidden_files_step2),
        'utf-8',
      );
      const real_stories_step1 = readFileSync(
        join(templatesPath, files.real_stories_step1),
        'utf-8',
      );
      const real_stories_step2 = readFileSync(
        join(templatesPath, files.real_stories_step2),
        'utf-8',
      );
      const structured_story_step1 = readFileSync(
        join(templatesPath, files.structured_story_step1),
        'utf-8',
      );
      const structured_story_step2 = readFileSync(
        join(templatesPath, files.structured_story_step2),
        'utf-8',
      );
      return res.status(200).json({
        basic_story_step1,
        basic_story_step2,
        hidden_beasts_step1,
        hidden_beasts_step2,
        hidden_files_step1,
        hidden_files_step2,
        real_stories_step1,
        real_stories_step2,
        structured_story_step1,
        structured_story_step2,
      });
    } catch (error) {
      return res.status(500).json({
        message: 'Error reading template files',
        error: error.message,
      });
    }
  }

  @Get('settings')
  @Render('ai-video-generation/settings')
  async getSettings(@Res() res: Response) {
    return {
      title: 'Settings',
      description: 'Settings for the AI Video Generation application',
    };
  }
}
