import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, ObjectId } from 'mongoose';

export type AudioDocument = Audio & Document;

@Schema({ timestamps: true })
export class Audio {
  _id: ObjectId;

  @Prop({ required: true })
  text: string;

  @Prop()
  url?: string;

  @Prop()
  publicId?: string;

  @Prop({ default: 'pending', enum: ['pending', 'finished'] })
  status: string;

  @Prop({ default: Date.now })
  createdAt: Date;

  @Prop({ required: true })
  videoId: string;

  @Prop({ required: true })
  order: number;
}

export const AudioSchema = SchemaFactory.createForClass(Audio);
