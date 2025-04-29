import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { CreatedStoriesController } from './controllers/created-stories.controller';
import { CreatedStoriesService } from './services/created-stories.service';
import {
  CreatedStory,
  CreatedStorySchema,
} from './schemas/created-story.schema';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: CreatedStory.name, schema: CreatedStorySchema },
    ]),
  ],
  controllers: [CreatedStoriesController],
  providers: [CreatedStoriesService],
  exports: [CreatedStoriesService],
})
export class CreatedStoriesModule {}
