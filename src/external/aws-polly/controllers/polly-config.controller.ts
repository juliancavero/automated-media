import {
  Controller,
  Get,
  Post,
  Put,
  Body,
  Param,
  NotFoundException,
  Query,
} from '@nestjs/common';
import { PollyConfigService } from '../services/polly-config.service';
import { CreatePollyConfigDto } from '../dto/polly-config.dto';
import { PollyConfig } from '../schemas/polly-config.schema';
import { pollyVoices } from '../interfaces/polly.voices';
import { Languages } from 'src/ai-video-generation/types';

@Controller('polly-config')
export class PollyConfigController {
  constructor(private readonly pollyConfigService: PollyConfigService) {}

  @Get()
  async getConfig(@Query('lang') lang: Languages): Promise<PollyConfig> {
    console.log('Fetching Polly configuration for language:', lang);
    const config = await this.pollyConfigService.getCurrentConfig(lang, false);
    if (!config) {
      throw new NotFoundException('No Polly configuration found');
    }
    return config;
  }

  @Get('voices')
  getVoices(): { name: string; language: string }[] {
    return pollyVoices;
  }

  @Post()
  async updateDefault(
    @Body() createDto: CreatePollyConfigDto,
  ): Promise<PollyConfig | null> {
    return this.pollyConfigService.updateDefault(createDto);
  }
}
