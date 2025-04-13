import { Injectable, Logger } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';

@Injectable()
export class QueueService {
  private readonly logger = new Logger(QueueService.name);
  private readonly queues: Map<string, Queue> = new Map();

  constructor(
    @InjectQueue('media-processing')
    mediaProcessingQueue: Queue,
    // Aquí puedes inyectar otras colas según necesites
  ) {
    this.queues.set('media-processing', mediaProcessingQueue);
    // Añade más colas al mapa según sea necesario
  }

  /**
   * Obtiene el estado de un trabajo a partir de su ID
   * Busca en todas las colas registradas
   */
  async getJobStatus(jobId: string): Promise<any> {
    this.logger.log(`Fetching status for job: ${jobId}`);

    // Intentar encontrar el trabajo en alguna de las colas
    for (const [queueName, queue] of this.queues.entries()) {
      const job = await queue.getJob(jobId);

      if (job) {
        const state = await job.getState();
        const progress = job.progress;

        this.logger.log(
          `Job ${jobId} found in queue: ${queueName}, state: ${state}`,
        );

        return {
          id: job.id,
          queueName,
          state,
          progress,
          data: job.data,
          returnvalue: job.returnvalue,
          failedReason: job.failedReason,
          createdAt: job.timestamp,
          finishedAt: job.finishedOn,
        };
      }
    }

    this.logger.warn(`Job ${jobId} not found in any queue`);
    return { status: 'not-found' };
  }
}
