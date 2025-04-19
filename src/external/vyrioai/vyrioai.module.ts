import { Module } from '@nestjs/common';
import { VyrioAiService } from './vyrioai.service';

@Module({
  providers: [VyrioAiService],
  exports: [VyrioAiService],
})
export class VyrioAiModule {}
