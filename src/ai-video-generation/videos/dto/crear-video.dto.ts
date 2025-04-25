export class CrearVideoDto {
  videoId: string;
  images: string[];
  audios: string[];
  addToBeContinued?: boolean;
  addTheEnd?: boolean;
}
