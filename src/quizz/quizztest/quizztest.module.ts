import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { QuizzTestService } from './quizztest.service';
import { QuizzTestController } from './quizztest.controller';
import { QuizzTest, QuizzTestSchema } from './schemas/quizztest.schema';
import { PreguntaModule } from '../pregunta/pregunta.module';
import { Pregunta, PreguntaSchema } from '../pregunta/schemas/pregunta.schema';
import { PuppeteerModule } from '../puppeteer/puppeteer.module';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: QuizzTest.name, schema: QuizzTestSchema },
      { name: Pregunta.name, schema: PreguntaSchema },
    ]),
    PreguntaModule,
    PuppeteerModule,
  ],
  controllers: [QuizzTestController],
  providers: [QuizzTestService],
  exports: [QuizzTestService],
})
export class QuizzTestModule {}
