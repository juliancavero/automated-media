import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { PreguntaService } from './pregunta.service';
import { PreguntaController } from './pregunta.controller';
import { Pregunta, PreguntaSchema } from './schemas/pregunta.schema';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: Pregunta.name, schema: PreguntaSchema },
    ]),
  ],
  controllers: [PreguntaController],
  providers: [PreguntaService],
  exports: [PreguntaService],
})
export class PreguntaModule {}
