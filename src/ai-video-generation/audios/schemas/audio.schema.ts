import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { ObjectId } from 'mongodb';
import { Document } from 'mongoose';
import { Languages, Status } from 'src/ai-video-generation/types';

export type AudioDocument = Audio & Document;

@Schema({ timestamps: true })
export class Audio {
  _id: ObjectId;

  @Prop({ required: true })
  text: string;

  @Prop({ required: true, enum: Languages })
  lang: string;

  @Prop()
  url?: string;

  @Prop()
  publicId?: string;

  @Prop({ default: Status.PENDING, enum: Status })
  status: Status;

  @Prop({ default: Date.now })
  createdAt: Date;

  @Prop({ required: true })
  videoId: string;

  @Prop({ required: true })
  order: number;

  @Prop({ type: ObjectId, ref: 'AudioConfig' })
  configId: ObjectId;
}

export const AudioSchema = SchemaFactory.createForClass(Audio);
