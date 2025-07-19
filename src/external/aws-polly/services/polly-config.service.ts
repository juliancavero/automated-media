import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { PollyConfigRepository } from '../repositories/polly-config.repository';
import { PollyConfig } from '../schemas/polly-config.schema';
import { CreatePollyConfigDto } from '../dto/polly-config.dto';
import { Languages } from 'src/ai-video-generation/types';

@Injectable()
export class PollyConfigService {
  private readonly logger = new Logger(PollyConfigService.name);

  constructor(private readonly pollyConfigRepository: PollyConfigRepository) {}

  async getCurrentConfig(
    lang: Languages,
    pickRandom: boolean = true,
  ): Promise<PollyConfig | null> {
    if (pickRandom) {
      const config = await this.pollyConfigRepository.find({ lang });
      if (config.length === 0) {
        this.logger.log('No existing Polly configuration found');
        return null;
      }
      const randomIndex = Math.floor(Math.random() * config.length);
      this.logger.log(
        `Returning random Polly configuration for language: ${lang}`,
      );
      return config[randomIndex];
    }

    const config = await this.pollyConfigRepository.find({
      lang,
      isDefault: true,
    });
    if (!config || config.length === 0) {
      this.logger.log(
        `No default Polly configuration found for language: ${lang}`,
      );
      throw new NotFoundException(
        `No default Polly configuration found for language: ${lang}`,
      );
    }
    return config[0];
  }

  async getConfigById(id: string): Promise<PollyConfig> {
    const config = await this.pollyConfigRepository.findById(id);
    if (!config) {
      throw new NotFoundException(
        `Polly configuration with ID ${id} not found`,
      );
    }
    return config;
  }

  async updateDefault(
    createDto: CreatePollyConfigDto,
  ): Promise<PollyConfig | null> {
    this.logger.log(
      `Updating default Polly configuration for language: ${createDto.lang}`,
    );

    // Find current default config by lang and isDefault: true
    const existingDefault =
      await this.pollyConfigRepository.findOneByLangAndDefault(
        createDto.lang,
        true,
      );

    // Find target config by lang and voiceId
    const targetConfig = await this.pollyConfigRepository.findOneByVoiceId(
      createDto.voiceId,
      createDto.lang,
    );

    if (!targetConfig) {
      this.logger.log(
        `Target Polly configuration not found for language: ${createDto.lang} and voiceId: ${createDto.voiceId}`,
      );
      return null;
    }

    // Update current default to isDefault: false
    if (existingDefault && existingDefault._id !== targetConfig._id) {
      await this.pollyConfigRepository.update(existingDefault._id, {
        isDefault: false,
      });
    }

    // Update target config to isDefault: true
    await this.pollyConfigRepository.update(targetConfig._id, {
      isDefault: true,
    });

    return this.pollyConfigRepository.findById(String(targetConfig._id));
  }
}
