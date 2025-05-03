import { Languages } from 'src/ai-video-generation/types';

export class CreatePollyConfigDto {
  voiceId: string;
  languageCode: string;
  lang: Languages;
}
