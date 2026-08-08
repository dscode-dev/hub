import type { INestApplication } from '@nestjs/common';
import { json, urlencoded } from 'express';
import { API_PREFIX } from './common/constants';
import { buildValidationPipe } from './common/pipes/validation.pipe';

/**
 * Configuracao compartilhada entre o bootstrap real e os testes de integracao.
 *
 * Existe para que os testes exercitem exatamente a mesma aplicacao que roda em
 * producao. Duplicar esses ajustes no harness ja mascarou um limite de corpo
 * divergente entre os dois caminhos.
 */
export function configureApp(app: INestApplication): void {
  app.setGlobalPrefix(API_PREFIX);
  app.useGlobalPipes(buildValidationPipe());

  /*
   * O padrao do body-parser (100 kb) e menor que a logo aceita no primeiro
   * acesso (512 kb, que em base64 passa de 700 kb). Sem este ajuste, uma logo
   * legitima seria recusada pelo parser antes de chegar a validacao.
   */
  app.use(json({ limit: '2mb' }));
  app.use(urlencoded({ extended: true, limit: '2mb' }));
}
