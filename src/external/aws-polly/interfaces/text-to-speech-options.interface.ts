import {
  LanguageCode,
  SynthesizeSpeechCommandInput,
  VoiceId,
} from '@aws-sdk/client-polly';

export type PollyLanguageCode =
  | 'en-US'
  | 'en-GB'
  | 'es-ES'
  | 'es-MX'
  | 'fr-FR'
  | 'fr-CA'
  | 'de-DE'
  | 'it-IT';

export type PollyEngine = 'standard' | 'neural' | 'long-form' | 'generative';

export type PollyOutputFormat = 'mp3' | 'ogg_vorbis' | 'pcm' | 'json';

export interface TextToSpeechOptions {
  voiceId: VoiceId;
  outputFormat: PollyOutputFormat;
  languageCode: LanguageCode;
  engine: PollyEngine;
}

export interface AudioResult {
  filename: string;
  filepath: string;
  text: string;
  url: string; // URL to access the audio file from the web
}

/**
 * Maps a TextToSpeechOptions object to SynthesizeSpeechCommandInput
 * Used for type conversion to AWS SDK format
 */
export function mapToSynthesizeSpeechInput(
  options: TextToSpeechOptions,
  text: string,
): SynthesizeSpeechCommandInput {
  return {
    Text: text,
    OutputFormat: options.outputFormat || 'mp3',
    VoiceId: options.voiceId || 'Joanna',
    LanguageCode: options.languageCode,
    Engine: options.engine || 'standard',
    TextType: 'text',
    SampleRate: '22050',
  };
}
