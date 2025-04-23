import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';
import { Job } from 'bullmq';
import { VideoGenerationService } from 'src/ai-video-generation/videos/services/video-generation.service';

interface VideoDescriptionGenerationJob {
    videoId: string;
}

@Processor('video-processing')
export class VideoQueueConsumer extends WorkerHost {
    private readonly logger = new Logger(VideoQueueConsumer.name);

    constructor(private readonly videoGenerationService: VideoGenerationService) {
        super();
    }

    async process(job: Job<VideoDescriptionGenerationJob>) {
        const { videoId } = job.data;

        try {
            this.logger.log(`Processing description generation for video: ${videoId}`);

            const result = await this.videoGenerationService.regenerateVideoDescription(videoId);

            if (!result) {
                throw new Error(`Failed to generate description for video: ${videoId}`);
            }

            this.logger.log(`Successfully generated description for video: ${videoId}`);
            return { success: true, videoId };
        } catch (error) {
            this.logger.error(
                `Failed to process video description generation job ${job.id}: ${error.message}`,
                error.stack,
            );
            throw error;
        }
    }
}
