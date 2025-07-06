export interface GenerateQuizTitleDto {
  // No necesita parámetros específicos, genera un título genérico
}

export interface GenerateQuestionDto {
  title: string;
  difficulty?: string;
}

export interface GenerateMultipleQuestionsDto {
  title: string;
  difficulty?: string;
}

export interface QuizQuestion {
  texto: string;
  respuestas: string[];
  indiceRespuestaCorrecta: number;
}

export interface GenerateScoresDto {
  title: string;
}
