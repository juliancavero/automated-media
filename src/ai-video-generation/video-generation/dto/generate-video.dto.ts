import { TextToSpeechOptions } from 'src/ai-video-generation/aws-polly/interfaces/text-to-speech-options.interface';

export class GenerateVideoDto {
  texts: string[];
  options: TextToSpeechOptions;
}
