import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, ObjectId } from 'mongoose';

export type PollyConfigDocument = PollyConfig & Document;

@Schema({ timestamps: true })
export class PollyConfig {
  _id: ObjectId;

  @Prop({ default: 'Joanna' })
  voiceId: string;

  @Prop({ default: 'en-US' })
  languageCode: string;

  @Prop({ default: Date.now })
  createdAt: Date;
  
  @Prop({ default: Date.now })
  updatedAt: Date;
}

export const PollyConfigSchema = SchemaFactory.createForClass(PollyConfig);
