import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

export type PreguntaDocument = Pregunta & Document;

@Schema({ timestamps: true })
export class Pregunta {
  @Prop({ required: true })
  texto: string;

  @Prop({
    required: true,
    type: [String],
    validate: {
      validator: function (respuestas: string[]) {
        return respuestas.length >= 2 && respuestas.length <= 4;
      },
      message: 'Las respuestas deben tener entre 2 y 4 opciones',
    },
  })
  respuestas: string[];

  @Prop({
    required: true,
    validate: {
      validator: function (indice: number) {
        return indice >= 0 && indice < this.respuestas.length;
      },
      message: 'El índice de respuesta correcta debe ser válido',
    },
  })
  indiceRespuestaCorrecta: number;

  @Prop({ required: false })
  imagen?: string;
}

export const PreguntaSchema = SchemaFactory.createForClass(Pregunta);
