export const QUIZ_TITLE_PROMPT = `Genera un título atractivo y creativo para un quiz. El título debe ser llamativo, concreto y específico sobre una temática clara. Debe ser corto (máximo 10 palabras) y no excesivamente efusivo. 

EJEMPLOS de títulos CORRECTOS:
- "¿Sabes más que un niño de primaria?"
- "¿Eres más listo que una lombriz?"
- "5 Preguntas sobre el Espacio: ¿Te las sabes todas?"
- "Historia de España: ¿Conoces las fechas?"
- "Matemáticas básicas: ¿Apruebas el examen?"

EVITA títulos como:
- "¿Qué tan bien conoces este tema? ¡Pon a prueba tu sabiduría!" (muy largo)
- "¿Qué tan bien conoces tu mundo? ¡Descúbrelo con este quiz épico!" (muy efusivo y largo)
- "¿Qué sabes de este tema?" (poco concreto)

El título debe estar en castellano (español de España). No incluyas comillas ni caracteres especiales al principio o final. Responde únicamente con el título.`;

export const QUIZ_QUESTION_PROMPT = `Genera una pregunta de quiz basada en el siguiente título: "{{title}}" con dificultad "{{difficulty}}". 

IMPORTANTE sobre la dificultad:
- Nivel "fácil": Preguntas muy básicas que cualquier persona promedio pueda responder con conocimiento general
- Nivel "difícil" o "imposible": Preguntas desafiantes pero que una persona medianamente inteligente pueda resolver con cultura general o razonamiento lógico
- NUNCA crear preguntas de nivel universitario, técnico especializado o que requieran conocimientos muy específicos de una carrera

La pregunta debe:
- Estar relacionada con la temática del título
- Tener exactamente 4 opciones de respuesta
- Ser clara y sin ambigüedades
- Tener una sola respuesta correcta
- Mantener un nivel apropiado según las indicaciones de dificultad
- Estar redactada en castellano (español de España)

Responde ÚNICAMENTE con un JSON válido en el siguiente formato:
{
  "texto": "¿Cuál es la pregunta?",
  "respuestas": ["Opción 1", "Opción 2", "Opción 3", "Opción 4"],
  "indiceRespuestaCorrecta": 0
}

IMPORTANTE: El array "respuestas" empieza en índice 0. Por ejemplo:
- Si la respuesta correcta es "Opción 1" (primera posición), el índice es 0
- Si la respuesta correcta es "Opción 2" (segunda posición), el índice es 1  
- Si la respuesta correcta es "Opción 3" (tercera posición), el índice es 2
- Si la respuesta correcta es "Opción 4" (cuarta posición), el índice es 3
VERIFICA que el índice corresponda exactamente a la posición de la respuesta correcta en el array.`;

export const QUIZ_MULTIPLE_QUESTIONS_PROMPT = `Genera exactamente 5 preguntas de quiz basadas en el siguiente título: "{{title}}" con dificultad "{{difficulty}}".

IMPORTANTE sobre la dificultad:
- Nivel "fácil": Preguntas muy básicas que cualquier persona promedio pueda responder con conocimiento general
- Nivel "difícil" o "imposible": Preguntas desafiantes pero que una persona medianamente inteligente pueda resolver con cultura general o razonamiento lógico
- NUNCA crear preguntas de nivel universitario, técnico especializado o que requieran conocimientos muy específicos de una carrera

Cada pregunta debe:
- Estar relacionada con la temática del título
- Tener exactamente 4 opciones de respuesta
- Ser clara y sin ambigüedades
- Tener una sola respuesta correcta
- Ser diferente a las demás preguntas
- Mantener un nivel apropiado según las indicaciones de dificultad
- Estar redactada en castellano (español de España)

Responde ÚNICAMENTE con un JSON válido que contenga un array con exactamente 5 preguntas en el siguiente formato:
[
  {
    "texto": "¿Primera pregunta?",
    "respuestas": ["Opción 1", "Opción 2", "Opción 3", "Opción 4"],
    "indiceRespuestaCorrecta": 0
  },
  {
    "texto": "¿Segunda pregunta?",
    "respuestas": ["Opción 1", "Opción 2", "Opción 3", "Opción 4"],
    "indiceRespuestaCorrecta": 1
  }
]

IMPORTANTE: El array "respuestas" empieza en índice 0. Por ejemplo:
- Si la respuesta correcta es "Opción 1" (primera posición), el índice es 0
- Si la respuesta correcta es "Opción 2" (segunda posición), el índice es 1  
- Si la respuesta correcta es "Opción 3" (tercera posición), el índice es 2
- Si la respuesta correcta es "Opción 4" (cuarta posición), el índice es 3
VERIFICA que el índice corresponda exactamente a la posición de la respuesta correcta en el array.`;

export const QUIZ_SCORES_PROMPT = `Genera exactamente 3 niveles de puntuación creativos y divertidos para un quiz basado en el siguiente título: "{{title}}". 

Los niveles deben ir del más básico/tonto al más inteligente/genial, y deben ser reconocibles por la mayoría de la gente. Pueden ser:
- Personajes de dibujos animados, series, películas
- Científicos famosos, celebridades, influencers
- Animales (desde menos a más inteligentes)
- Objetos, tecnologías (desde más simples a más avanzados)
- Superhéroes, personajes de cómics
- Cualquier cosa creativa que sea reconocible

EJEMPLOS de sets completos:
- ["Bart Simpson", "Homer Simpson", "Lisa Simpson"]
- ["Santiago Segura", "Mario Casas", "Javier Bardem"] 
- ["Lombriz", "Gato", "Delfín"]
- ["Reloj de arena", "Móvil", "ChatGPT"]
- ["Deadpool", "Spider-Man", "Mr. Fantastic"]

Los niveles deben:
- Ser divertidos y reconocibles
- Estar relacionados temáticamente entre sí
- Ir progresivamente de menor a mayor capacidad/inteligencia
- Ser apropiados para el tema del quiz
- Estar redactados en castellano (español de España)

Responde ÚNICAMENTE con un JSON válido en el siguiente formato:
{
  "scores": ["Nivel Básico", "Nivel Intermedio", "Nivel Avanzado"]
}`;
