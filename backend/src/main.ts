import { ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { AppModule } from './app.module.js';
import { HttpExceptionFilter } from './common/filters/http-exception.filter.js';

const DEFAULT_PORT = 3000;
const DEFAULT_CORS_ORIGIN = 'http://localhost:4200';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  app.setGlobalPrefix('api');
  app.enableCors({
    // Comma-separated list, e.g.
    // "http://localhost:4200,https://talentflow.appwrite.network"
    origin: (process.env.CORS_ORIGINS ?? DEFAULT_CORS_ORIGIN)
      .split(',')
      .map((origin: string) => origin.trim()),
  });
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );
  app.useGlobalFilters(new HttpExceptionFilter());

  // Interactive API docs at /api/docs
  const docs = new DocumentBuilder()
    .setTitle('TalentFlow API')
    .setVersion('1.0')
    .addBearerAuth()
    .build();
  SwaggerModule.setup('api/docs', app, SwaggerModule.createDocument(app, docs));

  app.enableShutdownHooks();
  await app.listen(process.env.PORT ?? DEFAULT_PORT);
}
await bootstrap();
