import {
  PollyEngine,
  PollyLanguageCode,
  PollyVoiceId,
} from '../interfaces/text-to-speech-options.interface';

export class TextToSpeechOptionsDto {
  voiceId?: PollyVoiceId;
  languageCode?: PollyLanguageCode;
  engine?: PollyEngine;
}

export class TextToSpeechRequestDto {
  texts: string[];
  options: TextToSpeechOptionsDto;
}
