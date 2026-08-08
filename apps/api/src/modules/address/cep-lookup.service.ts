import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
  ServiceUnavailableException,
} from '@nestjs/common';
import type { CepLookupDto } from '@hub/shared';

/**
 * Consulta de CEP.
 *
 * Roda no backend, e nao no renderer, por tres motivos concretos:
 *  - a CSP do aplicativo so libera `connect-src` para o proprio backend;
 *  - evita depender do CORS de um servico de terceiro;
 *  - concentra num unico ponto o timeout e o tratamento de "sem internet".
 *
 * A aplicacao e local-first: internet e uma conveniencia aqui, nunca um
 * requisito. Falha de rede vira 503 e o formulario segue preenchivel a mao.
 */
const VIACEP_URL = 'https://viacep.com.br/ws';
const LOOKUP_TIMEOUT_MS = 5_000;

interface ViaCepResponse {
  cep?: string;
  logradouro?: string;
  bairro?: string;
  localidade?: string;
  uf?: string;
  erro?: boolean | string;
}

@Injectable()
export class CepLookupService {
  private readonly logger = new Logger(CepLookupService.name);

  async lookup(rawCep: string): Promise<CepLookupDto> {
    const cep = normalizeCep(rawCep);

    if (cep.length !== 8) {
      throw new BadRequestException('Informe um CEP com 8 digitos.');
    }

    let response: Response;

    try {
      response = await fetchWithTimeout(`${VIACEP_URL}/${cep}/json/`, LOOKUP_TIMEOUT_MS);
    } catch (error) {
      // Sem internet, DNS fora ou timeout: nao e erro do usuario.
      this.logger.warn(
        `Consulta de CEP indisponivel: ${error instanceof Error ? error.message : String(error)}`,
      );

      throw new ServiceUnavailableException(
        'Nao foi possivel consultar o CEP agora. Preencha o endereco manualmente.',
      );
    }

    if (!response.ok) {
      throw new ServiceUnavailableException(
        'Nao foi possivel consultar o CEP agora. Preencha o endereco manualmente.',
      );
    }

    const data = (await response.json()) as ViaCepResponse;

    // O ViaCEP responde 200 com `erro: true` quando o CEP nao existe.
    if (data.erro) {
      throw new NotFoundException('CEP nao encontrado.');
    }

    return {
      zipCode: formatCep(cep),
      street: emptyToNull(data.logradouro),
      district: emptyToNull(data.bairro),
      city: emptyToNull(data.localidade),
      state: emptyToNull(data.uf)?.toUpperCase() ?? null,
    };
  }
}

/** `AbortSignal.timeout` nao existe em todo runtime alvo; controlamos na mao. */
async function fetchWithTimeout(url: string, timeoutMs: number): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  try {
    return await fetch(url, {
      signal: controller.signal,
      headers: { accept: 'application/json' },
    });
  } finally {
    clearTimeout(timer);
  }
}

export function normalizeCep(value: string): string {
  return value.replace(/\D/g, '');
}

function formatCep(cep: string): string {
  return `${cep.slice(0, 5)}-${cep.slice(5)}`;
}

function emptyToNull(value: string | undefined): string | null {
  const trimmed = value?.trim();
  return trimmed ? trimmed : null;
}
