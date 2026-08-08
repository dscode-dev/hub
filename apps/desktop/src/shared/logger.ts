import { app } from 'electron';
import { createWriteStream, mkdirSync, type WriteStream } from 'node:fs';
import { join } from 'node:path';

/**
 * Logger minimo do runtime desktop.
 *
 * Escreve no stdout (util em dev) e num arquivo em userData (util em suporte,
 * onde nao existe terminal). Sem plataforma de observabilidade: o objetivo e
 * responder "por que a aplicacao nao abriu" numa maquina de cliente.
 */

type Level = 'info' | 'warn' | 'error';

let stream: WriteStream | null = null;

function fileStream(): WriteStream | null {
  if (stream) {
    return stream;
  }

  try {
    const dir = join(app.getPath('userData'), 'logs');
    mkdirSync(dir, { recursive: true });
    stream = createWriteStream(join(dir, 'desktop.log'), { flags: 'a' });
  } catch {
    // Sem permissao de escrita: seguimos apenas com stdout.
    return null;
  }

  return stream;
}

function write(level: Level, scope: string, message: string, detail?: unknown): void {
  const timestamp = new Date().toISOString();
  const suffix = detail === undefined ? '' : ` ${formatDetail(detail)}`;
  const line = `${timestamp} [${level.toUpperCase()}] [${scope}] ${message}${suffix}`;

  if (level === 'error') {
    process.stderr.write(`${line}\n`);
  } else {
    process.stdout.write(`${line}\n`);
  }

  fileStream()?.write(`${line}\n`);
}

function formatDetail(detail: unknown): string {
  if (detail instanceof Error) {
    return `${detail.name}: ${detail.message}`;
  }

  if (typeof detail === 'string') {
    return detail;
  }

  try {
    return JSON.stringify(detail);
  } catch {
    return String(detail);
  }
}

export interface Logger {
  info(message: string, detail?: unknown): void;
  warn(message: string, detail?: unknown): void;
  error(message: string, detail?: unknown): void;
}

export function createLogger(scope: string): Logger {
  return {
    info: (message, detail) => write('info', scope, message, detail),
    warn: (message, detail) => write('warn', scope, message, detail),
    error: (message, detail) => write('error', scope, message, detail),
  };
}

export function closeLogger(): void {
  stream?.end();
  stream = null;
}
