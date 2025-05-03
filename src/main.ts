import { NestFactory } from '@nestjs/core';
import { Logger } from '@nestjs/common';
import { AppModule } from './app.module';
import * as fs from 'fs';
import * as path from 'path';
import { NestExpressApplication } from '@nestjs/platform-express';
import * as hbs from 'hbs';
import * as express from 'express';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import * as cookieParser from 'cookie-parser';

// Helper function to create directories safely
function ensureDirectoryExists(dir: string, logger: Logger): void {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
    logger.log(`Created directory at: ${dir}`);
  }
}

async function bootstrap() {
  const logger = new Logger('Bootstrap');

  // Create required directories
  const tempDir = path.join(process.cwd(), 'temp');
  const viewsDir = path.join(process.cwd(), 'views');
  const publicDir = path.join(process.cwd(), 'public');
  const videosDir = path.join(publicDir, 'videos');
  const partialsDir = path.join(viewsDir, 'partials');

  ensureDirectoryExists(tempDir, logger);
  ensureDirectoryExists(viewsDir, logger);
  ensureDirectoryExists(publicDir, logger);
  ensureDirectoryExists(videosDir, logger);
  ensureDirectoryExists(partialsDir, logger);

  // Check for important environment variables
  if (!process.env.GOOGLE_AI_API_KEY) {
    logger.warn(
      'GOOGLE_AI_API_KEY not set. AI functionality will be limited to mock responses.',
    );
  }

  const app = await NestFactory.create<NestExpressApplication>(AppModule);

  // Use cookie parser to extract cookies
  app.use(cookieParser());

  const config = new DocumentBuilder()
    .setTitle('Cats example')
    .setDescription('The cats API description')
    .setVersion('1.0')
    .setExternalDoc('Postman Collection', 'api-json')
    .addTag('cats')
    .build();
  const documentFactory = () => SwaggerModule.createDocument(app, config);
  SwaggerModule.setup('api', app, documentFactory);

  // Serve static files from the public directory
  app.use('/videos', express.static(path.join(process.cwd(), 'public/videos')));
  app.use(express.static(path.join(process.cwd(), 'public')));

  // Configure Handlebars as the view engine
  app.setViewEngine('hbs');
  app.setBaseViewsDir(path.join(process.cwd(), 'views'));

  // Register handlebars partials
  hbs.registerPartials(partialsDir);

  // Register Handlebars helpers
  hbs.registerHelper('add', function (value1, value2) {
    return value1 + value2;
  });

  hbs.registerHelper('generatePageNumbers', (currentPage, totalPages) => {
    const pages: number[] = [];
    const maxPagesToShow = 5;

    let startPage = Math.max(1, currentPage - Math.floor(maxPagesToShow / 2));
    let endPage = startPage + maxPagesToShow - 1;

    if (endPage > totalPages) {
      endPage = totalPages;
      startPage = Math.max(1, endPage - maxPagesToShow + 1);
    }

    for (let i = startPage; i <= endPage; i++) {
      pages.push(i);
    }

    return pages;
  });

  hbs.registerHelper('eq', function (arg1, arg2) {
    return arg1 === arg2;
  });

  hbs.registerHelper('truncate', function (text, length) {
    if (!text) return '';
    return text.length > length ? text.substring(0, length) + '...' : text;
  });
  hbs.registerHelper('truncateShort', function (text, length) {
    if (!text) return '';
    return text.length > length ? text.substring(0, length) : text;
  });
  hbs.registerHelper('neq', function (a, b) {
    return a !== b;
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

  hbs.registerHelper('formatDateInput', function (date) {
    if (!date) return '';
    const d = new Date(date);
    return d.toISOString().split('T')[0]; // Format as YYYY-MM-DD
  });

  hbs.registerHelper('now', function () {
    return new Date();
  });

  const port = process.env.PORT ?? 10000;
  const host = process.env.HOST ?? '0.0.0.0';

  await app.listen(port, host);
  logger.log(`Application is running on: http://${host}:${port}`);
}
bootstrap();
