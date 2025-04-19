import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { Image, ImageDocument } from '../schemas/image.schema';
import { ImageQueueService } from '../queues/image-queue.service';

@Injectable()
export class ImageService {
  constructor(
    @InjectModel(Image.name)
    private readonly imageModel: Model<ImageDocument>,
    private readonly imageQueueService: ImageQueueService,
  ) { }

  async createImage(
    text: string,
    videoId: string,
    order: number,
  ): Promise<Image> {
    return this.imageModel.create({
      text,
      videoId,
      order,
    });
  }

  async getAllImages(): Promise<Image[]> {
    return await this.imageModel.find().sort({ createdAt: -1 }).exec();
  }

  async getImageById(id: string): Promise<Image | null> {
    return await this.imageModel.findById(id).exec();
  }

  async findByVideoId(videoId: string): Promise<Image[]> {
    return await this.imageModel
      .find({ videoId })
      .sort({ createdAt: -1 })
      .exec();
  }

  async deleteImage(id: string): Promise<void> {
    const image = await this.imageModel.findById(id);
    if (image) {
      await image.deleteOne();
    } else {
      throw new Error('Image not found');
    }
  }

  async setImageUrl(
    id: string,
    url: string,
    publicId: string,
  ): Promise<Image | null> {
    return await this.imageModel
      .findByIdAndUpdate(
        id,
        { url, publicId, status: 'finished' },
        { new: true, runValidators: true },
      )
      .exec();
  }

  async relaunchFailedImages(): Promise<void> {
    const failedImages = await this.imageModel
      .find({ status: 'pending' })
      .exec();

    for (const image of failedImages) {
      await this.imageQueueService.addImageGenerationJob(image);
    }
  }
}
