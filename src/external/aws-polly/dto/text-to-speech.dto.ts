import { VoiceId } from '@aws-sdk/client-polly';
import {
  PollyEngine,
  PollyLanguageCode,
} from '../interfaces/text-to-speech-options.interface';

export class TextToSpeechOptionsDto {
  voiceId?: VoiceId;
  languageCode?: PollyLanguageCode;
  engine?: PollyEngine;
}

export class TextToSpeechRequestDto {
  texts: string[];
  options: TextToSpeechOptionsDto;
}
