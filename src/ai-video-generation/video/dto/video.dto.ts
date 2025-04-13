export class VideoFromImagesDto {
  images: string[];
  outputPath: string;
  options?: {
    framerate?: number;
    duration?: number;
    resolution?: string;
  };
}

export class MergeVideosDto {
  videos: string[];
  outputPath: string;
}
