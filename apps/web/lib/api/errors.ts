/** Formato de erro normalizado pela API (AllExceptionsFilter). */
export interface ApiErrorBody {
  statusCode: number;
  message: string;
  fieldErrors?: Record<string, string[]>;
}

export class ApiError extends Error {
  readonly status: number;
  readonly fieldErrors: Record<string, string[]>;

  constructor(status: number, message: string, fieldErrors: Record<string, string[]> = {}) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.fieldErrors = fieldErrors;
  }

  get isUnauthorized(): boolean {
    return this.status === 401;
  }

  get isNotFound(): boolean {
    return this.status === 404;
  }
}

export async function toApiError(response: Response): Promise<ApiError> {
  let body: Partial<ApiErrorBody> = {};

  try {
    body = (await response.json()) as Partial<ApiErrorBody>;
  } catch {
    // Resposta sem corpo JSON (502, timeout do proxy, etc.)
  }

  return new ApiError(
    response.status,
    body.message ?? mensagemPadrao(response.status),
    body.fieldErrors ?? {},
  );
}

function mensagemPadrao(status: number): string {
  if (status === 401) {
    return 'Sua sessao expirou. Entre novamente.';
  }

  if (status === 403) {
    return 'Voce nao tem permissao para executar esta acao.';
  }

  if (status === 404) {
    return 'Registro nao encontrado.';
  }

  if (status >= 500) {
    return 'Nao conseguimos concluir agora. Tente novamente em instantes.';
  }

  return 'Nao foi possivel concluir a operacao.';
}
