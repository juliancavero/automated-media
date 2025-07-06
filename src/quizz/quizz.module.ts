import { Module } from '@nestjs/common';
import { PreguntaModule } from './pregunta/pregunta.module';
import { QuizzTestModule } from './quizztest/quizztest.module';
import { QuizzAiModule } from './ai/quizz-ai.module';

@Module({
  imports: [PreguntaModule, QuizzTestModule, QuizzAiModule],
  exports: [PreguntaModule, QuizzTestModule, QuizzAiModule],
})
export class QuizzModule {}
