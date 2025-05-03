import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { ObjectId } from 'mongoose';
import { Languages } from 'src/ai-video-generation/types';

@Schema({ timestamps: true })
export class PollyConfig {
  _id: ObjectId;

  @Prop({ default: 'Joanna' })
  voiceId: string;

  @Prop({ default: 'en-US' })
  languageCode: string;

  @Prop({ required: true, enum: Languages })
  lang: string;

  @Prop({ default: true })
  isActive: boolean;
}

export const PollyConfigSchema = SchemaFactory.createForClass(PollyConfig);
