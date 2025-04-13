import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { AwsPollyService } from './aws-polly.service';

@Module({
  imports: [ConfigModule],
  controllers: [],
  providers: [AwsPollyService],
  exports: [AwsPollyService],
})
export class AwsPollyModule {}
