import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { ObjectId } from 'mongodb';
import { Languages } from 'src/ai-video-generation/types';
import { Engine, LanguageCode } from '@aws-sdk/client-polly';

@Schema({ timestamps: true })
export class PollyConfig {
  _id: ObjectId;

  @Prop({ default: 'Joanna' })
  voiceId: string;

  @Prop({ default: 'en-US' })
  languageCode: LanguageCode;

  @Prop({ required: true, enum: Languages })
  lang: string;

  @Prop({ required: true })
  engine: Engine;

  @Prop({ default: false })
  isDefault: boolean;

  @Prop({ default: true })
  enabled: boolean;
}

export const PollyConfigSchema = SchemaFactory.createForClass(PollyConfig);
