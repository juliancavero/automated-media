import { Engine, LanguageCode, VoiceId } from '@aws-sdk/client-polly';
import { Languages } from 'src/ai-video-generation/types';

export class CreatePollyConfigDto {
  voiceId: VoiceId;
  languageCode: LanguageCode;
  lang: Languages;
  engine: Engine;
}
