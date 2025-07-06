// Test file to validate the new QuizzTest properties
// This file demonstrates how to use the new difficulty, difficultyText, and scores properties

export interface TestQuizzTestData {
  titulo: string;
  difficulty: 'easy' | 'medium' | 'hard' | 'impossible';
  difficultyText: string;
  scores: string[];
  preguntas: {
    texto: string;
    respuestas: string[];
    indiceRespuestaCorrecta: number;
    imagen?: string;
  }[];
}

// Example test data demonstrating the new properties
export const sampleQuizzTestData: TestQuizzTestData = {
  titulo: 'Quiz de Programación Básica',
  difficulty: 'easy',
  difficultyText: 'Quiz introductorio para principiantes en programación',
  scores: ['Principiante', 'Intermedio', 'Avanzado', 'Experto'],
  preguntas: [
    {
      texto: '¿Qué significa HTML?',
      respuestas: [
        'HyperText Markup Language',
        'Home Tool Markup Language',
        'Hyperlinks and Text Markup Language',
        'HyperTool Markup Language',
      ],
      indiceRespuestaCorrecta: 0,
    },
    {
      texto: '¿Cuál es la extensión de archivo para JavaScript?',
      respuestas: ['.java', '.js', '.script', '.javascript'],
      indiceRespuestaCorrecta: 1,
    },
  ],
};

// Test cases for different difficulty levels
export const difficultyTestCases: TestQuizzTestData[] = [
  {
    ...sampleQuizzTestData,
    titulo: 'Quiz Fácil',
    difficulty: 'easy',
    difficultyText: 'Conceptos básicos para principiantes',
    scores: ['Novato', 'Aprendiz'],
  },
  {
    ...sampleQuizzTestData,
    titulo: 'Quiz Medio',
    difficulty: 'medium',
    difficultyText: 'Conocimientos intermedios requeridos',
    scores: ['Competente', 'Hábil', 'Experto'],
  },
  {
    ...sampleQuizzTestData,
    titulo: 'Quiz Difícil',
    difficulty: 'hard',
    difficultyText: 'Para desarrolladores experimentados',
    scores: ['Profesional', 'Senior', 'Arquitecto'],
  },
  {
    ...sampleQuizzTestData,
    titulo: 'Quiz Imposible',
    difficulty: 'impossible',
    difficultyText: 'Solo para los más valientes y sabios',
    scores: ['Héroe', 'Leyenda', 'Dios del Código'],
  },
];

// Validation functions
export function validateDifficulty(difficulty: string): boolean {
  return ['easy', 'medium', 'hard', 'impossible'].includes(difficulty);
}

export function validateScoresArray(scores: string[]): boolean {
  return (
    Array.isArray(scores) && scores.every((score) => typeof score === 'string')
  );
}

// Usage example:
// const newQuiz = await quizzTestService.createWithQuestions(sampleQuizzTestData);
