import { Controller, Get, Res } from '@nestjs/common';
import { Response } from 'express';
import { readFileSync } from 'fs';
import { join } from 'path';

@Controller('')
export class AppController {
    constructor() { }

    @Get()
    async redirectToVideosList(@Res() res: Response) {
        return res.redirect('/videos/list');
    }

    @Get('templates')
    async getTemplates(@Res() res: Response) {
        try {
            const templatesPath = join(process.cwd(), 'public', 'templates');

            const basic_story = readFileSync(join(templatesPath, 'basic_story.txt'), 'utf8');
            const basic_story_json = readFileSync(join(templatesPath, 'basic_story_json.txt'), 'utf8');
            const structured_story = readFileSync(join(templatesPath, 'structured_story.txt'), 'utf8');
            const structured_story_json = readFileSync(join(templatesPath, 'structured_story_json.txt'), 'utf8');
            const real_story = readFileSync(join(templatesPath, 'real_story.txt'), 'utf8');
            const real_story_json = readFileSync(join(templatesPath, 'real_story_json.txt'), 'utf8');

            return res.status(200).json({
                basic_story,
                basic_story_json,
                structured_story,
                structured_story_json,
                real_story,
                real_story_json
            });
        } catch (error) {
            return res.status(500).json({
                message: 'Error reading template files',
                error: error.message
            });
        }
    }
}
