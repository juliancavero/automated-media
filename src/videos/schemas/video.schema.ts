import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Schema as MongooseSchema } from 'mongoose';

export type VideoDocument = Video & Document;

@Schema({
  timestamps: true,
})
export class Video {
  _id?: MongooseSchema.Types.ObjectId;

  @Prop({ required: true })
  url: string;

  @Prop()
  description?: string;

  @Prop({ default: false })
  uploaded: boolean;
}

export const VideoSchema = SchemaFactory.createForClass(Video);
