export type JobType = 'process-video' | 'process-audio' | 'process-image';

export interface QueueJobData {
  type: JobType;
  data: any;
}

export interface VideoProcessingData {
  videoPath: string;
  outputPath?: string;
  options?: {
    format?: string;
    resolution?: string;
    bitrate?: number;
  };
}

export interface AudioProcessingData {
  audioPath: string;
  outputPath?: string;
  options?: {
    format?: string;
    bitrate?: number;
    normalize?: boolean;
  };
}

export interface ImageProcessingData {
  imagePath: string;
  outputPath?: string;
  options?: {
    format?: string;
    width?: number;
    height?: number;
    quality?: number;
  };
}
