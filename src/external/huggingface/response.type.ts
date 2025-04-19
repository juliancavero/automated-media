export type ReplicateImageGenerationResponse = {
  id: string;
  model: string;
  version: string;
  input: {
    prompt: string;
  };
  logs: string;
  output: null;
  data_removed: boolean;
  error: null;
  status: string;
  created_at: string;
  urls: {
    cancel: string;
    get: string;
    stream: string;
  };
};
