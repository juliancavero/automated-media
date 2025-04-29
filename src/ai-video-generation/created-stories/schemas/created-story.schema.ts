import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';
import { VideoType } from '../../types';

@Schema({ timestamps: true })
export class CreatedStory extends Document {
  @Prop({ required: true, enum: VideoType, type: String })
  type: VideoType;

  @Prop({ required: true, type: [String] })
  titles: string[];
}

export const CreatedStorySchema = SchemaFactory.createForClass(CreatedStory);
