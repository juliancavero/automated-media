export const VIDEO_DESCRIPTION_PROMPT =
  'Analyze this video and create a compelling description with relevant hashtags. The description (excluding hashtags) must be NO MORE THAN 40 WORDS. Use a serious, mysterious, and realistic tone that conveys depth and authenticity. Avoid playful or casual language. Include trending hashtags relevant to dark/mysterious content such as #thriller, #suspense, #scary, #creepytok, #mysterytok, #shorthorror, #urbanlegend, #unusual, #stories, #story, and similar trending tags in {{lang}}. Respond with only the caption text, written in {{lang}}.';

export const TRANSLATION_PROMPT =
  'Translate the following text to {{translatedLang}}. Return ONLY the translation, without any additional text or suggestions:';

export const REFINE_TRANSCRIPTIONS_PROMPT = `You are a transcription refinement expert. You will receive a list of transcription segments (single words) and a context text (full sentences). Your task is to correct each transcription segment based on the context text, while preserving the original timestamps and any other metadata associated with the transcription segment. The original transcriptions are approximations and may contain errors. The context text is the accurate version of the entire speech. Do not add any additional text or suggestions. Return ONLY a JSON array containing the corrected transcription segments. If a word is already correct, return it as is.
          
Context text: {{contextText}}
Transcription segments: {{transcriptions}}
`;
