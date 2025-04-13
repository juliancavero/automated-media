import { PollyVoiceId } from '../../aws-polly/interfaces/text-to-speech-options.interface';

export class CreateAudioDto {
  text: string;
  voice?: PollyVoiceId;
}
