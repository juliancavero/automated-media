import { NestFactory } from '@nestjs/core';
import { Logger } from '@nestjs/common';
import { AppModule } from './app.module';
import * as fs from 'fs';
import * as path from 'path';
import { NestExpressApplication } from '@nestjs/platform-express';
import * as hbs from 'hbs';

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

  // Register Handlebars helpers
  hbs.registerHelper('truncate', function (text, length) {
    if (!text) return '';
    return text.length > length ? text.substring(0, length) + '...' : text;
  });

  hbs.registerHelper('formatDate', function (date) {
    return new Date(date).toLocaleString('es-ES', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
    });
  });

  const port = process.env.PORT ?? 3000;

  await app.listen(port);
  logger.log(`Application is running on: http://localhost:${port}`);
}
bootstrap();
