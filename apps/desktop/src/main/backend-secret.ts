import { app, safeStorage } from 'electron';
import { randomBytes } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { createLogger } from '../shared/logger';

const log = createLogger('secret');

/**
 * Segredo de assinatura dos tokens, por instalacao.
 *
 * Em desenvolvimento o backend le `JWT_ACCESS_SECRET` do `.env`. O aplicativo
 * instalado nao tem `.env` - e embutir um segredo no pacote seria pior do que
 * nao ter nenhum: o mesmo valor estaria em todas as maquinas, e qualquer um
 * poderia extrair do instalador e forjar um token valido em qualquer cliente.
 *
 * Entao cada instalacao gera o proprio segredo no primeiro boot e o guarda no
 * `userData`, cifrado pelo Keychain / DPAPI / libsecret. Ele precisa ser
 * estavel entre reinicios: trocar o segredo invalidaria todas as sessoes e o
 * usuario teria que logar de novo a cada abertura do app.
 */

const SECRET_FILE = 'backend-secret.bin';
/** 64 bytes em hex: bem acima do minimo de 32 caracteres exigido pela API. */
const SECRET_BYTES = 64;

function secretPath(): string {
  const dir = join(app.getPath('userData'), 'secure');
  mkdirSync(dir, { recursive: true });

  return join(dir, SECRET_FILE);
}

/**
 * Le o segredo existente ou cria um novo.
 *
 * Sem cofre do SO, grava em texto puro com permissao 0600. E uma troca
 * consciente: o alternativo seria o app simplesmente nao abrir. O arquivo fica
 * no diretorio do usuario, com a mesma protecao do banco - que, afinal, ja
 * guarda os proprios dados do negocio ao lado.
 */
export function resolveBackendSecret(): string {
  const path = secretPath();
  const encrypted = safeStorage.isEncryptionAvailable();

  if (existsSync(path)) {
    try {
      const raw = readFileSync(path);
      const secret = encrypted ? safeStorage.decryptString(raw) : raw.toString('utf8').trim();

      if (secret.length >= 32) {
        return secret;
      }

      log.warn('Segredo existente invalido; um novo sera gerado');
    } catch (error) {
      // Cofre trocado (outro usuario do SO, keychain resetado): regenerar e a
      // unica saida. O custo e refazer o login, nao perder dados.
      log.warn('Nao foi possivel ler o segredo; um novo sera gerado', error);
    }
  }

  const secret = randomBytes(SECRET_BYTES).toString('hex');

  try {
    writeFileSync(path, encrypted ? safeStorage.encryptString(secret) : secret, { mode: 0o600 });

    if (!encrypted) {
      log.warn('Cofre do sistema indisponivel; segredo gravado apenas com permissao restrita');
    }
  } catch (error) {
    // Nao propaga: o app sobe com o segredo em memoria. So custa novo login no
    // proximo boot, em vez de recusar a abrir.
    log.error('Falha ao gravar o segredo; ele valera apenas para esta sessao', error);
  }

  // O valor nunca e logado - nem aqui, nem no spawn do backend.
  log.info('Segredo de assinatura pronto');

  return secret;
}
