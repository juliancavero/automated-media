import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { Image, ImageDocument } from '../schemas/image.schema';
import { ImageQueueService } from '../queues/image-queue.service';
import { CloudinaryService } from 'src/external/cloudinary/cloudinary.service';

@Injectable()
export class ImageService {
  private readonly logger = new Logger(ImageService.name);

  constructor(
    @InjectModel(Image.name)
    private readonly imageModel: Model<ImageDocument>,
    private readonly imageQueueService: ImageQueueService,
    private readonly cloudinaryService: CloudinaryService,
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

  async getAllImages(page = 1, limit = 10): Promise<{ images: Image[], total: number, pages: number }> {
    const skip = (page - 1) * limit;
    const [images, total] = await Promise.all([
      this.imageModel.find()
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .exec(),
      this.imageModel.countDocuments()
    ]);

    const pages = Math.ceil(total / limit);

    return { images, total, pages };
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
    const image = await this.imageModel.findById(id).exec();
    if (!image) {
      throw new NotFoundException(`Image with ID ${id} not found`);
    }

    // Delete from Cloudinary if publicId exists
    if (image.publicId) {
      try {
        await this.cloudinaryService.deleteFile(image.publicId, 'image');
        this.logger.log(`Deleted image file from Cloudinary: ${image.publicId}`);
      } catch (error) {
        this.logger.error(`Failed to delete image from Cloudinary: ${error.message}`);
      }
    }

    // Delete from database
    await this.imageModel.findByIdAndDelete(id).exec();
    this.logger.log(`Deleted image from database: ${id}`);
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

  async regenerateImage(id: string): Promise<void> {
    const image = await this.imageModel.findById(id);
    if (!image) {
      throw new Error('Image not found');
    }

    // Reset the image status to pending
    await this.imageModel.findByIdAndUpdate(
      id,
      { status: 'pending', url: null, publicId: null },
      { runValidators: true }
    ).exec();

    // Add to the queue
    await this.imageQueueService.addImageGenerationJob(image);
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
