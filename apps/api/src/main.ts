import 'reflect-metadata';
import { Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { NestFactory } from '@nestjs/core';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { AppModule } from './app.module';
import { API_PREFIX } from './common/constants';
import { buildValidationPipe } from './common/pipes/validation.pipe';

async function bootstrap(): Promise<void> {
  const app = await NestFactory.create(AppModule, { bufferLogs: false });
  const configService = app.get(ConfigService);

  app.setGlobalPrefix(API_PREFIX);
  app.useGlobalPipes(buildValidationPipe());

  const corsOrigins = configService.get<string[]>('app.corsOrigins') ?? [];
  if (corsOrigins.length > 0) {
    app.enableCors({ origin: corsOrigins, credentials: true });
  }

  if (configService.get<boolean>('app.swaggerEnabled')) {
    const config = new DocumentBuilder()
      .setTitle('Plataforma Hub API')
      .setDescription('API de gestao operacional multi-tenant da Plataforma Hub')
      .setVersion('1.0')
      .addBearerAuth()
      .build();

    SwaggerModule.setup('docs', app, SwaggerModule.createDocument(app, config), {
      swaggerOptions: { persistAuthorization: true },
    });
  }

  const port = configService.get<number>('app.port') ?? 5010;
  await app.listen(port);

  Logger.log(`API em http://localhost:${port}/${API_PREFIX}`, 'Bootstrap');
  Logger.log(`Swagger em http://localhost:${port}/docs`, 'Bootstrap');
}

void bootstrap();
