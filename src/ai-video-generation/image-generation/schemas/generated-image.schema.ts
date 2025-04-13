import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, ObjectId } from 'mongoose';

export type GeneratedImageDocument = GeneratedImage & Document;

@Schema({
  timestamps: true,
})
export class GeneratedImage {
  _id: ObjectId;

  @Prop({ required: true })
  prompt: string;

  @Prop({ required: true })
  imageData: string; // Base64 encoded image data

  @Prop({ required: true })
  mimeType: string;

  @Prop()
  description?: string;

  @Prop({ required: true })
  videoId: string;

  @Prop({ required: true })
  order: number;
}

export const GeneratedImageSchema =
  SchemaFactory.createForClass(GeneratedImage);
