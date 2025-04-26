import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, ObjectId } from 'mongoose';

export type VideoDocument = Video & Document;

@Schema({ timestamps: true })
export class Video {
  _id: ObjectId;

  @Prop({ required: true })
  texts: string[];

  @Prop()
  url?: string;

  @Prop()
  publicId?: string;

  @Prop({ default: 'pending', enum: ['pending', 'finished', 'uploaded'] })
  status: string;

  @Prop()
  series?: string;

  @Prop()
  description?: string;

  @Prop({ default: 'basic', enum: ['basic', 'structured', 'real'] })
  type: string;

  @Prop({ default: Date.now })
  createdAt: Date;
  @Prop({ default: Date.now })
  updatedAt: Date;
  @Prop()
  uploadedAt?: Date;
}

export const VideoSchema = SchemaFactory.createForClass(Video);
