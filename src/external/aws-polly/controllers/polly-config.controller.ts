import { Controller, Get, Post, Put, Body, Param, NotFoundException } from '@nestjs/common';
import { PollyConfigService } from '../services/polly-config.service';
import { CreatePollyConfigDto } from '../dto/polly-config.dto';
import { PollyConfig } from '../schemas/polly-config.schema';
import { pollyVoices } from '../interfaces/polly.voices';

@Controller('polly-config')
export class PollyConfigController {
  constructor(private readonly pollyConfigService: PollyConfigService) {}

  @Get()
  async getConfig(): Promise<PollyConfig> {
    const config = await this.pollyConfigService.getCurrentConfig();
    if (!config) {
      throw new NotFoundException('No Polly configuration found');
    }
    return config;
  }

  @Get('voices')
  getVoices(): {name: string, language: string}[] {
    return pollyVoices;
  }

  @Post()
  async createConfig(@Body() createDto: CreatePollyConfigDto): Promise<PollyConfig | null> {
    return this.pollyConfigService.createConfig(createDto);
  }
}
