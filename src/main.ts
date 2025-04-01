import { NestFactory } from '@nestjs/core';
import { Logger } from '@nestjs/common';
import { AppModule } from './app.module';
import * as fs from 'fs';
import * as path from 'path';

async function bootstrap() {
  const logger = new Logger('Bootstrap');

  // Create temp directory if it doesn't exist
  const tempDir = path.join(process.cwd(), 'temp');
  if (!fs.existsSync(tempDir)) {
    fs.mkdirSync(tempDir, { recursive: true });
    logger.log(`Created temp directory at: ${tempDir}`);
  }

  // Check for important environment variables
  if (!process.env.GOOGLE_AI_API_KEY) {
    logger.warn(
      'GOOGLE_AI_API_KEY not set. AI functionality will be limited to mock responses.',
    );
  }

  const app = await NestFactory.create(AppModule);
  const port = process.env.PORT ?? 3000;

  await app.listen(port);
  logger.log(`Application is running on: http://localhost:${port}`);
}
bootstrap();
