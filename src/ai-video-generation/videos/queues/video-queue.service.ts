import { InjectQueue } from '@nestjs/bullmq';
import { Injectable, Logger } from '@nestjs/common';
import { Queue } from 'bullmq';
import { v4 } from 'uuid';

@Injectable()
export class VideoQueueService {
    private readonly logger = new Logger(VideoQueueService.name);

    constructor(
        @InjectQueue('video-processing') private readonly videoQueue: Queue,
    ) { }

    async addVideoDescriptionGenerationJob(videoId: string): Promise<string> {
        try {
            const uuid = v4();
            await this.videoQueue.add(
                'generate-description',
                { videoId },
                {
                    attempts: 3,
                    backoff: {
                        type: 'exponential',
                        delay: 5000,
                    },
                    removeOnComplete: true,
                    removeOnFail: false,
                    jobId: uuid,
                },
            );

            return uuid;
        } catch (error) {
            this.logger.error(
                `Failed to add video description generation job to queue: ${error.message}`,
                error.stack,
            );
            throw error;
        }
    }
}
