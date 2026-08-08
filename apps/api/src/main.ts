import 'reflect-metadata';
import { Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { NestFactory } from '@nestjs/core';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { AppModule } from './app.module';
import { API_PREFIX } from './common/constants';
import { startParentWatchdog } from './common/parent-watchdog';
import { configureApp } from './configure-app';
import { prepareDatabase } from './database/database-bootstrap';

async function bootstrap(): Promise<void> {
  // Rede de seguranca caso o Electron seja morto a forca.
  startParentWatchdog();

  /*
   * Diretorio, banco e migrations antes de qualquer coisa. Se falhar, o
   * processo morre e o Electron mostra a tela de erro - jamais atendemos
   * requisicoes com o schema desatualizado.
   */
  await prepareDatabase();

  const app = await NestFactory.create(AppModule, { bufferLogs: false });
  const configService = app.get(ConfigService);

  configureApp(app);

  /*
   * CORS do runtime desktop.
   *
   * O renderer empacotado roda em `hub://app` (esquema proprio do Electron) e,
   * em dev, no dev server do Next. Ambas as origens sao nomeadas: nada de
   * `origin: '*'`, que abriria a API local para qualquer pagina aberta no
   * navegador da mesma maquina.
   */
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

  const port = configService.get<number>('app.port') ?? 3001;
  const host = configService.get<string>('app.host') ?? '127.0.0.1';

  /*
   * Bind explicito em loopback: o backend do PDV atende somente a maquina onde
   * roda. Em `0.0.0.0` qualquer dispositivo da rede da loja alcancaria a API.
   */
  await app.listen(port, host);

  Logger.log(`API em http://${host}:${port}/${API_PREFIX}`, 'Bootstrap');
  Logger.log(`Swagger em http://${host}:${port}/docs`, 'Bootstrap');
}

void bootstrap();
