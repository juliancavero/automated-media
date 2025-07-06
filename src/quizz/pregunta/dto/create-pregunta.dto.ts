export class CreatePreguntaDto {
  texto: string;
  respuestas: string[];
  indiceRespuestaCorrecta: number;
  imagen?: string;
}
