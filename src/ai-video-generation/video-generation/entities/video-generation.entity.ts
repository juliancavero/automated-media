import { TextToSpeechOptions } from 'src/ai-video-generation/aws-polly/interfaces/text-to-speech-options.interface';
import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, ObjectId } from 'mongoose';

export type VideoGenerationDocument = VideoGeneration & Document;

@Schema({ timestamps: true })
export class VideoGeneration {
  _id: ObjectId;

  @Prop({ required: true })
  texts: string[];

  @Prop({ required: true, type: Object })
  options: TextToSpeechOptions;

  @Prop()
  jobs: string[];

  @Prop()
  url?: string;

  @Prop({ default: Date.now })
  createdAt: Date;
  @Prop({ default: Date.now })
  updatedAt: Date;
}

export const VideoGenerationSchema =
  SchemaFactory.createForClass(VideoGeneration);
