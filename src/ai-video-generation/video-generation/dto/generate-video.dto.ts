export class AudioConfig {
  voice: string;
  language: string;
  speed?: number;
}

export class GenerateVideoDto {
  texts: string[];
  audioConfig: AudioConfig;
}
