import { Module } from '@nestjs/common';
import { SubtitlesService } from './subtitles.service';
import { SubtitlesController } from './subtitles.controller';
import { AiModule } from '../ai/ai.module';

@Module({
  controllers: [SubtitlesController],
  providers: [SubtitlesService],
  exports: [SubtitlesService],
  imports: [AiModule],
})
export class SubtitlesModule {}
