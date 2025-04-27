import { VideoType } from "./video-types";

export class GenerateVideoDto {
  texts: string[];
  images: string[];
  series?: string;
  type?: VideoType;
}
