export enum VideoType {
  BASIC = 'basic',
  STRUCTURED = 'structured',
  REAL = 'real',
  HIDDEN_BEASTS = 'hidden_beasts',
  HIDDEN_FILES = 'hidden_files',
  FIRST_PERSON = 'first_person',
  CENSORED = 'censored',
  ALIENS = 'aliens',
}

export enum Status {
  PENDING = 'pending',
  FINISHED = 'finished',
  UPLOADED = 'uploaded',
  ERROR = 'error',
  PROCESSING = 'processing',
  QUEUED = 'queued',
}

export enum Languages {
  EN = 'en',
  ES = 'es',
}
export const getTargetLanguage = (lang: Languages): Languages => {
  switch (lang) {
    case Languages.EN:
      return Languages.ES;
    case Languages.ES:
      return Languages.EN;
    default:
      return Languages.ES;
  }
};
