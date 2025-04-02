import { NestFactory } from '@nestjs/core';
import { Logger } from '@nestjs/common';
import { AppModule } from './app.module';
import * as fs from 'fs';
import * as path from 'path';
import { NestExpressApplication } from '@nestjs/platform-express';

async function bootstrap() {
  const logger = new Logger('Bootstrap');

  // Create temp directory if it doesn't exist
  const tempDir = path.join(process.cwd(), 'temp');
  if (!fs.existsSync(tempDir)) {
    fs.mkdirSync(tempDir, { recursive: true });
    logger.log(`Created temp directory at: ${tempDir}`);
  }

  // Create views directory if it doesn't exist
  const viewsDir = path.join(process.cwd(), 'views');
  if (!fs.existsSync(viewsDir)) {
    fs.mkdirSync(viewsDir, { recursive: true });
    logger.log(`Created views directory at: ${viewsDir}`);
  }

  // Check for important environment variables
  if (!process.env.GOOGLE_AI_API_KEY) {
    logger.warn(
      'GOOGLE_AI_API_KEY not set. AI functionality will be limited to mock responses.',
    );
  }

  const app = await NestFactory.create<NestExpressApplication>(AppModule);

  // Configure Handlebars as the view engine
  app.setViewEngine('hbs');
  app.setBaseViewsDir(path.join(process.cwd(), 'views'));

  const port = process.env.PORT ?? 3000;

  await app.listen(port);
  logger.log(`Application is running on: http://localhost:${port}`);
}
bootstrap();
