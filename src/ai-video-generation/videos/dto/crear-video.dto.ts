import { Languages } from 'src/ai-video-generation/types';

export class CrearVideoDto {
  videoId: string;
  images: string[];
  audios: string[];
  addToBeContinued?: boolean;
  addTheEnd?: boolean;
  lang: Languages;
}
