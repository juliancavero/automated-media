import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, ObjectId } from 'mongoose';

@Schema({ timestamps: true })
export class PollyConfig {
  _id: ObjectId;

  @Prop({ default: 'Joanna' })
  voiceId: string;

  @Prop({ default: 'en-US' })
  languageCode: string;

  @Prop({ default: true })
  isActive: boolean;
}

export const PollyConfigSchema = SchemaFactory.createForClass(PollyConfig);
