import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, ObjectId } from 'mongoose';

export type ImageDocument = Image & Document;

@Schema({
  timestamps: true,
})
export class Image {
  _id: ObjectId;

  @Prop({ required: true })
  text: string;

  @Prop()
  url?: string;

  @Prop()
  publicId?: string;

  @Prop({ default: 'pending', enum: ['pending', 'finished'] })
  status: string;

  @Prop({ required: true })
  videoId: string;

  @Prop({ required: true })
  order: number;
}

export const ImageSchema = SchemaFactory.createForClass(Image);
