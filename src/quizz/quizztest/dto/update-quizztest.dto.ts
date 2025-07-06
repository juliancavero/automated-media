import { PartialType } from '@nestjs/mapped-types';
import { CreateQuizzTestDto } from './create-quizztest.dto';

export class UpdateQuizzTestDto extends PartialType(CreateQuizzTestDto) {}
