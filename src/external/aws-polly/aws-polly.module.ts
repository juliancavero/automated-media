import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { ConfigModule } from '@nestjs/config';
import { AwsPollyService } from './aws-polly.service';
import { PollyConfig, PollyConfigSchema } from './schemas/polly-config.schema';
import { PollyConfigRepository } from './repositories/polly-config.repository';
import { PollyConfigService } from './services/polly-config.service';
import { PollyConfigController } from './controllers/polly-config.controller';

@Module({
  imports: [
    ConfigModule,
    MongooseModule.forFeature([
      { name: PollyConfig.name, schema: PollyConfigSchema },
    ]),
  ],
  providers: [
    AwsPollyService,
    PollyConfigRepository,
    PollyConfigService,
  ],
  controllers: [PollyConfigController],
  exports: [AwsPollyService],
})
export class AwsPollyModule {}
