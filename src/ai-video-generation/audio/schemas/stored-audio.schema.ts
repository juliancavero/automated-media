import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, ObjectId } from 'mongoose';

export type StoredAudioDocument = StoredAudio & Document;

@Schema({ timestamps: true })
export class StoredAudio {
  _id: ObjectId;

  @Prop({ required: true })
  originalText: string;

  @Prop({ required: true })
  audioData: string; // Base64 encoded audio data

  @Prop({ required: true })
  mimeType: string;

  @Prop({ required: true })
  format: string;

  @Prop()
  voiceId?: string;

  @Prop()
  languageCode?: string;

  @Prop()
  engine?: string;

  @Prop()
  fileName?: string;

  @Prop({ default: Date.now })
  createdAt: Date;

  @Prop({ required: true })
  videoId: string;

  @Prop({ required: true })
  order: number;
}

export const StoredAudioSchema = SchemaFactory.createForClass(StoredAudio);
