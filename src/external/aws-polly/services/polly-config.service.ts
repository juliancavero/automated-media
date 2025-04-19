import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { PollyConfigRepository } from '../repositories/polly-config.repository';
import { PollyConfig } from '../schemas/polly-config.schema';
import { CreatePollyConfigDto } from '../dto/polly-config.dto';

@Injectable()
export class PollyConfigService {
  private readonly logger = new Logger(PollyConfigService.name);

  constructor(private readonly pollyConfigRepository: PollyConfigRepository) {}

  async getCurrentConfig(): Promise<PollyConfig | null> {
    const config = await this.pollyConfigRepository.findOne();
    if (!config) {
      this.logger.log('No existing Polly configuration found');
      return null;
    }
    return config;
  }

  async getConfigById(id: string): Promise<PollyConfig> {
    const config = await this.pollyConfigRepository.findById(id);
    if (!config) {
      throw new NotFoundException(`Polly configuration with ID ${id} not found`);
    }
    return config;
  }

  async createConfig(createDto: CreatePollyConfigDto): Promise<PollyConfig | null> {
    const existingConfig = await this.pollyConfigRepository.findOne();
    if (existingConfig) {
      this.logger.log('Updating existing Polly configuration');
      return this.pollyConfigRepository.update(String(existingConfig._id), createDto);
    }
    this.logger.log('Creating new Polly configuration');
    return this.pollyConfigRepository.create(createDto);
  }
}
