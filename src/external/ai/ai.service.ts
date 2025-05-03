import { Injectable, Logger, UnauthorizedException } from '@nestjs/common';
import { GoogleAIUploadService } from '../google-ai-upload/google-ai-upload.service';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { Languages } from 'src/ai-video-generation/types';

const VIDEO_DESCRIPTION_PROMPT =
  'Analyze this video and create a compelling description with relevant hashtags. The description (excluding hashtags) must be NO MORE THAN 40 WORDS. Use a serious, mysterious, and realistic tone that conveys depth and authenticity. Avoid playful or casual language. Include trending hashtags relevant to dark/mysterious content such as #thriller, #suspense, #scary, #creepytok, #mysterytok, #shorthorror, #urbanlegend, #unusual, #stories, #story, and similar trending tags in {{lang}}. Respond with only the caption text, written in {{lang}}.';
@Injectable()
export class AiService {
  private readonly logger = new Logger(AiService.name);
  private readonly ai: GoogleGenerativeAI;

  constructor(private readonly googleAIUploadService: GoogleAIUploadService) {
    // Get API key from environment variable
    const apiKey = process.env.GOOGLE_AI_API_KEY;
    if (!apiKey) {
      this.logger.error(
        'GOOGLE_AI_API_KEY not set. AI functionality will not work.',
      );
    }
    this.ai = new GoogleGenerativeAI(apiKey || '');
  }

  async generateVideoDescription(
    videoUrl: string,
    lang: Languages,
  ): Promise<string> {
    this.logger.log(`Generating description for video URL: ${videoUrl}`);

    if (!process.env.GOOGLE_AI_API_KEY) {
      throw new UnauthorizedException('GOOGLE_AI_API_KEY is not set');
    }

    try {
      const file =
        await this.googleAIUploadService.uploadVideoFromUrl(videoUrl);

      try {
        this.logger.log(`Generating description for video: ${file.name}`);
        const model = this.ai.getGenerativeModel({ model: 'gemini-2.0-flash' });
        const fileDataPart = {
          fileData: {
            mimeType: file.mimeType,
            fileUri: file.uri,
          },
        };
        const promptWithLang = VIDEO_DESCRIPTION_PROMPT.replace(
          /{{lang}}/g,
          this.translateLanguage(lang),
        );

        const textPart = { text: promptWithLang };

        const result = await model.generateContent([fileDataPart, textPart]);

        const description = result.response.text();
        if (!description) {
          throw new Error(`Could not generate description for ${videoUrl}`);
        }
        return description;
      } catch (error) {
        this.logger.error(
          `Error generating description with File API: ${error.message}`,
          error.stack,
        );
        throw error;
      }
    } catch (error) {
      this.logger.error(
        `Error uploading video to Google AI: ${error.message}`,
        error.stack,
      );
      throw error;
    }
  }

  async generateTextFromPrompt(prompt: string): Promise<string> {
    this.logger.log(`Generating text for prompt: ${prompt}`);

    if (!process.env.GOOGLE_AI_API_KEY) {
      throw new UnauthorizedException('GOOGLE_AI_API_KEY is not set');
    }

    try {
      const model = this.ai.getGenerativeModel({ model: 'gemini-2.0-flash' });
      const result = await model.generateContent(prompt);

      const response = result.response.text();
      if (!response) {
        throw new Error('Could not generate text from the provided prompt');
      }

      return response;
    } catch (error) {
      this.logger.error(
        `Error generating text from prompt: ${error.message}`,
        error.stack,
      );
      throw error;
    }
  }

  async translateTexts(texts: string[], lang: Languages): Promise<string[]> {
    this.logger.log(`Translating texts to ${this.translateLanguage(lang)}`);

    if (!process.env.GOOGLE_AI_API_KEY) {
      throw new UnauthorizedException('GOOGLE_AI_API_KEY is not set');
    }
    if (!texts || texts.length === 0) {
      this.logger.warn('No texts provided for translation');
      return [];
    }
    if (!lang) {
      this.logger.warn('No language provided for translation');
      throw new Error('Language is required for translation');
    }

    try {
      const model = this.ai.getGenerativeModel({ model: 'gemini-2.0-flash' });
      const translatedLang = this.translateLanguage(lang);
      const translationPrompt = `Translate the following text to ${translatedLang}. Return ONLY the translation, without any additional text or suggestions:`;

      const translatedTexts: string[] = [];
      for (const text of texts) {
        const translation = await model.generateContent(
          translationPrompt + text,
        );
        const translatedText = translation.response.text();
        if (!translatedText) {
          throw new Error(`Could not translate the text: ${text}`);
        }
        translatedTexts.push(translatedText);
      }

      this.logger.log('Texts translated successfully');
      return translatedTexts;
    } catch (error) {
      this.logger.error(
        `Error translating texts: ${error.message}`,
        error.stack,
      );
      throw error;
    }
  }

  translateLanguage(lang: Languages): string {
    switch (lang) {
      case Languages.EN:
        return 'English';
      case Languages.ES:
        return 'Spanish';
      default:
        throw new Error(`Unsupported language: ${lang}`);
    }
  }
}
