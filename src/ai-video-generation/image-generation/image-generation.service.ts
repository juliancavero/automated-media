import { Injectable, Logger, UnauthorizedException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { GoogleGenAI } from '@google/genai';
import {
  GeneratedImage,
  GeneratedImageDocument,
} from './schemas/generated-image.schema';

interface InlineData {
  data: string;
  mimeType: string;
}

interface Part {
  inlineData: InlineData;
  text?: string;
}

interface Content {
  parts: Part[];
  role: string;
}

interface Candidate {
  content: Content;
  finishReason: string;
  index: number;
}

interface AIResponse {
  candidates: Candidate[];
  promptFeedback?: any;
}

@Injectable()
export class ImageGenerationService {
  private readonly logger = new Logger(ImageGenerationService.name);
  private readonly genAI: GoogleGenAI;

  constructor(
    @InjectModel(GeneratedImage.name)
    private readonly generatedImageModel: Model<GeneratedImageDocument>,
  ) {
    // Get API key from environment variable
    const apiKey = process.env.GOOGLE_AI_API_KEY;
    if (!apiKey) {
      this.logger.error(
        'GOOGLE_AI_API_KEY not set. AI functionality will not work.',
      );
    }
    this.genAI = new GoogleGenAI({
      apiKey: apiKey || '',
    });
  }

  async generateImageFromText(
    prompt: string,
    videoId: string,
    order: number,
  ): Promise<string> {
    this.logger.log(`Generating image for prompt: ${prompt}`);

    if (!process.env.GOOGLE_AI_API_KEY) {
      throw new UnauthorizedException('GOOGLE_AI_API_KEY is not set');
    }

    try {
      // Properly format the request according to Gemini's requirements
      const response = await this.genAI.models.generateContent({
        model: 'gemini-2.0-flash-exp-image-generation',
        contents:
          'Generate a high-quality, photorealistic image that visually represents the following concept. Do not include any text, labels, or words in the image itself: \n\n' +
          prompt,
        config: {
          responseModalities: ['Text', 'Image'],
        },
      });

      // Check if we have a valid response
      if (!response) {
        throw new Error('Invalid response from AI service');
      }

      const candidates = response.candidates;
      if (!candidates || candidates.length === 0) {
        throw new Error('No candidates found in the response');
      }

      const content = candidates[0].content;
      if (!content || !content.parts || content.parts.length === 0) {
        throw new Error('No content parts found in the response');
      }

      // Look for image data in the parts
      let imageData = '';
      let mimeType = 'image/png';

      for (const part of content.parts) {
        if (part.text) {
          this.logger.log(part.text);
        } else if (part.inlineData) {
          imageData = part.inlineData.data || '';
          mimeType = part.inlineData.mimeType || 'image/png';

          if (imageData) {
            // Save the image to MongoDB
            const savedImage = await this.generatedImageModel.create({
              prompt,
              imageData,
              mimeType,
              description: `Create an image based on the: ${prompt}`,
              videoId,
              order,
            });

            this.logger.log(
              `Image saved to MongoDB with ID: ${savedImage._id}`,
            );

            // Return URL to access the image via API
            return `http://localhost:8080/images/view/${savedImage._id}`;
          }
        }
      }

      // If we reached here, no image data was found
      this.logger.error('No image data found in the API response parts');
      throw new Error('No image data found in response');
    } catch (error) {
      this.logger.error(
        `Error generating image: ${error.message}`,
        error.stack,
      );
      throw error;
    }
  }

  async getAllImages(): Promise<GeneratedImage[]> {
    try {
      return await this.generatedImageModel
        .find()
        .sort({ createdAt: -1 })
        .exec();
    } catch (error) {
      this.logger.error(`Error retrieving all images: ${error.message}`);
      throw error;
    }
  }

  async getImageById(id: string): Promise<GeneratedImage | null> {
    try {
      return await this.generatedImageModel.findById(id).exec();
    } catch (error) {
      this.logger.error(
        `Error retrieving image with ID ${id}: ${error.message}`,
      );
      throw error;
    }
  }

  async findByVideoId(videoId: string): Promise<GeneratedImage[]> {
    try {
      return await this.generatedImageModel
        .find({ videoId })
        .sort({ createdAt: -1 })
        .exec();
    } catch (error) {
      this.logger.error(
        `Error retrieving images for video ID ${videoId}: ${error.message}`,
      );
      throw error;
    }
  }
}
