import { Module } from '@nestjs/common';
import { QuizzAiService } from './quizz-ai.service';
import { QuizzAiController } from './quizz-ai.controller';

@Module({
  providers: [QuizzAiService],
  controllers: [QuizzAiController],
  exports: [QuizzAiService],
})
export class QuizzAiModule {}
