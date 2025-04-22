import { Controller, Get, Res } from '@nestjs/common';
import { Response } from 'express';
import basic_story from 'public/templates/basic_story';
import basic_story_json from 'public/templates/basic_story_json';
import structured_story from 'public/templates/structured_story';
import structured_story_json from 'public/templates/structured_story_json';

@Controller('')
export class AppController {
    constructor() { }

    @Get()
    async redirectToVideosList(@Res() res: Response) {
        return res.redirect('/videos/list');
    }

    @Get('templates')
    async getTemplates(@Res() res: Response) {
        return res.status(200).json({
            basic_story,
            basic_story_json,
            structured_story,
            structured_story_json,
        });
    }
}
