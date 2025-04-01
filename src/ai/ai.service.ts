import { Injectable, Logger } from '@nestjs/common';
import { GoogleGenerativeAI, Part } from '@google/generative-ai';

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
      this.logger.warn(
        'GOOGLE_AI_API_KEY not set. AI functionality will be limited.',
      );
    }
    this.genAI = new GoogleGenerativeAI(apiKey || 'dummy-key');
  }

  async generateVideoDescriptionWithFileData(
    mimeType: string,
    fileUri: string,
  ): Promise<string> {
    this.logger.log(
      `Generating description for video with File API: ${fileUri}`,
    );

    if (!process.env.GOOGLE_AI_API_KEY) {
      this.logger.warn(
        'Using mock description because GOOGLE_AI_API_KEY is not set',
      );
      return `This is an AI-generated description for the video with URI ${fileUri}.`;
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
      return description || `Could not generate description for ${fileUri}`;
    } catch (error) {
      this.logger.error(
        `Error generating description with File API: ${error.message}`,
        error.stack,
      );
      return `An automated description could not be generated for this video due to technical issues. Video URI: ${fileUri}`;
    }
  }
}
