import { PartialType } from '@nestjs/mapped-types';
import { CreateQuizzTestDto } from './create-quizztest.dto';

export class UpdateQuizzTestDto extends PartialType(CreateQuizzTestDto) {}

export class UpdateQuizzWithQuestionsDto {
  titulo?: string;
  difficulty?: 'easy' | 'medium' | 'hard' | 'impossible';
  difficultyText?: string;
  scores?: string[];
  preguntas?: {
    _id?: string; // For existing questions
    texto: string;
    respuestas: string[];
    indiceRespuestaCorrecta: number;
    imagen?: string;
  }[];
}
