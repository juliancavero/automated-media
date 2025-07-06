export class CreateQuizzTestDto {
  titulo: string;
  preguntas: string[];
  difficulty: 'easy' | 'medium' | 'hard' | 'impossible';
  difficultyText: string;
  scores?: string[];
}

export class CreateQuizzWithQuestionsDto {
  titulo: string;
  difficulty: 'easy' | 'medium' | 'hard' | 'impossible';
  difficultyText: string;
  scores?: string[];
  preguntas: {
    texto: string;
    respuestas: string[];
    indiceRespuestaCorrecta: number;
    imagen?: string;
  }[];
}
