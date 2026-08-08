import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import type { Request, Response } from 'express';

/** A partir daqui o erro e nosso, nao do cliente: vira log de erro. */
const SERVER_ERROR_THRESHOLD = 500;
const PAYLOAD_TOO_LARGE = 413;

interface ErrorBody {
  statusCode: number;
  message: string;
  /** Erros por campo, no formato consumido diretamente pelos formularios. */
  fieldErrors?: Record<string, string[]>;
  path: string;
  timestamp: string;
}

/**
 * Normaliza toda saida de erro da API em um unico formato.
 * O frontend depende disso para exibir mensagens sem parsear varios formatos.
 */
@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  private readonly logger = new Logger(AllExceptionsFilter.name);

  catch(exception: unknown, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();

    const body = this.buildBody(exception, request.url);

    if (body.statusCode >= SERVER_ERROR_THRESHOLD) {
      this.logger.error(
        `${request.method} ${request.url} -> ${body.statusCode}`,
        exception instanceof Error ? exception.stack : String(exception),
      );
    }

    response.status(body.statusCode).json(body);
  }

  private buildBody(exception: unknown, path: string): ErrorBody {
    const timestamp = new Date().toISOString();

    if (exception instanceof HttpException) {
      const status = exception.getStatus();
      const payload = exception.getResponse();

      if (typeof payload === 'string') {
        return { statusCode: status, message: payload, path, timestamp };
      }

      const record = payload as { message?: string | string[]; fieldErrors?: unknown };
      const rawMessage = record.message;

      return {
        statusCode: status,
        message: Array.isArray(rawMessage)
          ? (rawMessage[0] ?? 'Requisicao invalida')
          : (rawMessage ?? exception.message),
        fieldErrors: this.isFieldErrors(record.fieldErrors) ? record.fieldErrors : undefined,
        path,
        timestamp,
      };
    }

    if (exception instanceof Prisma.PrismaClientKnownRequestError) {
      return { ...this.mapPrismaError(exception), path, timestamp };
    }

    /*
     * Middlewares do Express (body-parser, multer) lancam erros com status
     * proprio que nao sao HttpException. Sem este ramo, um corpo grande demais
     * virava "erro interno" e escondia a causa real de quem chamou.
     */
    const middlewareStatus = this.extractMiddlewareStatus(exception);

    if (middlewareStatus) {
      return {
        statusCode: middlewareStatus,
        message:
          middlewareStatus === PAYLOAD_TOO_LARGE
            ? 'O conteudo enviado e grande demais.'
            : 'Requisicao invalida.',
        path,
        timestamp,
      };
    }

    return {
      statusCode: HttpStatus.INTERNAL_SERVER_ERROR,
      message: 'Erro interno do servidor',
      path,
      timestamp,
    };
  }

  private mapPrismaError(
    error: Prisma.PrismaClientKnownRequestError,
  ): Pick<ErrorBody, 'statusCode' | 'message'> {
    switch (error.code) {
      case 'P2002':
        return {
          statusCode: HttpStatus.CONFLICT,
          message: 'Ja existe um registro com esses dados',
        };
      case 'P2003':
        return {
          statusCode: HttpStatus.BAD_REQUEST,
          message: 'Referencia invalida para outro registro',
        };
      case 'P2025':
        return { statusCode: HttpStatus.NOT_FOUND, message: 'Registro nao encontrado' };
      default:
        return {
          statusCode: HttpStatus.INTERNAL_SERVER_ERROR,
          message: 'Erro ao acessar o banco de dados',
        };
    }
  }

  /** Extrai o status de erros de middleware, aceitando apenas 4xx. */
  private extractMiddlewareStatus(exception: unknown): number | null {
    if (typeof exception !== 'object' || exception === null) {
      return null;
    }

    const { status, statusCode } = exception as { status?: unknown; statusCode?: unknown };
    const value = typeof status === 'number' ? status : statusCode;

    if (typeof value !== 'number' || value < 400 || value >= SERVER_ERROR_THRESHOLD) {
      return null;
    }

    return value;
  }

  private isFieldErrors(value: unknown): value is Record<string, string[]> {
    return typeof value === 'object' && value !== null && !Array.isArray(value);
  }
}
