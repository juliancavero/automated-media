import { Injectable, Logger, UnauthorizedException } from '@nestjs/common';
import { GoogleGenerativeAI } from '@google/generative-ai';

const VIDEO_DESCRIPTION_PROMPT =
  'Act as a TikTok Content Manager. Analyze the provided video and generate a single, engaging, and optimized caption with relevant hashtags. Respond with the caption only, without any extra text or options.';
@Injectable()
export class AiService {
  private readonly logger = new Logger(AiService.name);
  private readonly genAI: GoogleGenerativeAI;

  constructor() {
    // Get API key from environment variable
    const apiKey = process.env.GOOGLE_AI_API_KEY;
    if (!apiKey) {
      this.logger.error(
        'GOOGLE_AI_API_KEY not set. AI functionality will not work.',
      );
    }
    this.genAI = new GoogleGenerativeAI(apiKey || '');
  }

  async generateVideoDescriptionWithFileData(
    mimeType: string,
    fileUri: string,
  ): Promise<string> {
    this.logger.log(
      `Generating description for video with File API: ${fileUri}`,
    );

    if (!process.env.GOOGLE_AI_API_KEY) {
      throw new UnauthorizedException('GOOGLE_AI_API_KEY is not set');
    }

    try {
      const model = this.genAI.getGenerativeModel({ model: 'gemini-1.5-pro' });

      const fileDataPart = {
        fileData: {
          mimeType: mimeType,
          fileUri: fileUri,
        },
      };

      const textPart = { text: VIDEO_DESCRIPTION_PROMPT };

      const result = await model.generateContent([fileDataPart, textPart]);

      const description = result.response.text();
      if (!description) {
        throw new Error(`Could not generate description for ${fileUri}`);
      }
      return description;
    } catch (error) {
      this.logger.error(
        `Error generating description with File API: ${error.message}`,
        error.stack,
      );
      throw error;
    }
  }
}
