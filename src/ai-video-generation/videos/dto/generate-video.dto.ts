import { VideoType } from "src/ai-video-generation/types";

export class GenerateVideoDto {
  texts: string[];
  images: string[];
  series?: string;
  type?: VideoType;
}
