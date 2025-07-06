import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';

export type QuizzTestDocument = QuizzTest & Document;

@Schema({ timestamps: true })
export class QuizzTest {
  @Prop({ required: true })
  titulo: string;

  @Prop({
    required: true,
    type: [{ type: Types.ObjectId, ref: 'Pregunta' }],
    validate: {
      validator: function (preguntas: Types.ObjectId[]) {
        return preguntas.length > 0;
      },
      message: 'El quiz debe tener al menos una pregunta',
    },
  })
  preguntas: Types.ObjectId[];

  @Prop({
    required: true,
    enum: ['easy', 'medium', 'hard', 'impossible'],
    default: 'medium',
  })
  difficulty: 'easy' | 'medium' | 'hard' | 'impossible';

  @Prop({ required: true })
  difficultyText: string;

  @Prop({
    type: [String],
    default: [],
  })
  scores: string[];
}

export const QuizzTestSchema = SchemaFactory.createForClass(QuizzTest);
