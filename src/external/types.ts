export interface TranscriptionSegment {
  timestamps: { from: string; to: string };
  offsets: { from: number; to: number };
  text: string;
}

export interface SimplifiedTranscriptionSegment {
  from: number;
  to: number;
  text: string;
}
