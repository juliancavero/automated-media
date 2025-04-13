export class CreateStoredAudioDto {
  originalText: string;
  audioData: string;
  mimeType: string;
  format: string;
  voiceId?: string;
  languageCode?: string;
  engine?: string;
  fileName?: string;
}
