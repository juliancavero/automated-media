import { Injectable, Logger, UnauthorizedException } from '@nestjs/common';
import { GoogleAIUploadService } from '../google-ai-upload/google-ai-upload.service';
import { GoogleGenerativeAI } from '@google/generative-ai';

const VIDEO_DESCRIPTION_PROMPT =
  'Analyze this video and create a compelling description with relevant hashtags. The description (excluding hashtags) must be NO MORE THAN 40 WORDS. Use a serious, mysterious, and realistic tone that conveys depth and authenticity. Avoid playful or casual language. Include trending hashtags relevant to dark/mysterious content such as #thriller, #suspense, #scary, #creepytok, #mysterytok, #shorthorror, #urbanlegend, #unusual, #stories, #story, and similar trending tags. Respond with only the caption text.';
@Injectable()
export class AiService {
  private readonly logger = new Logger(AiService.name);
  private readonly ai: GoogleGenerativeAI;

  constructor(
    private readonly googleAIUploadService: GoogleAIUploadService,
  ) {
    // Get API key from environment variable
    const apiKey = process.env.GOOGLE_AI_API_KEY;
    if (!apiKey) {
      this.logger.error(
        'GOOGLE_AI_API_KEY not set. AI functionality will not work.',
      );
    }
    this.ai = new GoogleGenerativeAI(apiKey || '');
  }

  async generateVideoDescription(videoUrl: string): Promise<string> {
    this.logger.log(`Generating description for video URL: ${videoUrl}`);

    if (!process.env.GOOGLE_AI_API_KEY) {
      throw new UnauthorizedException('GOOGLE_AI_API_KEY is not set');
    }

    try {
      // Upload the video URL directly to Google AI
      this.logger.log(`Uploading video to Google AI: ${videoUrl}`);

      const file = await this.googleAIUploadService.uploadVideoFromUrl(
        videoUrl,
      );

      try {
        this.logger.log(`Generating description for video: ${file.name}`);
        const model = this.ai.getGenerativeModel({ model: 'gemini-2.0-flash' });
        const fileDataPart = {
          fileData: {
            mimeType: file.mimeType,
            fileUri: file.uri,
          },
        };
        const textPart = { text: VIDEO_DESCRIPTION_PROMPT };

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
}
