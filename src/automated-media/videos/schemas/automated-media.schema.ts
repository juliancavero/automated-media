import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Schema as MongooseSchema } from 'mongoose';

export type AutomatedMediaDocument = AutomatedMedia & Document;

@Schema({
  timestamps: true,
})
export class AutomatedMedia {
  _id: MongooseSchema.Types.ObjectId;

  @Prop({ required: true })
  url: string;

  @Prop()
  description?: string;

  @Prop({ default: false })
  uploaded: boolean;

  @Prop()
  publicId: string;
}

export const AutomatedMediaSchema =
  SchemaFactory.createForClass(AutomatedMedia);
