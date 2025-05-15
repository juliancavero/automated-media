import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, ObjectId } from 'mongoose';
import { Status } from 'src/ai-video-generation/types';

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

  @Prop({ default: Status.PENDING, enum: Status })
  status: Status;

  @Prop({ required: true })
  videoId: string;

  @Prop({ required: true })
  order: number;
}

export const ImageSchema = SchemaFactory.createForClass(Image);
