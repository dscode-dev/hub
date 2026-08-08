import type { DesktopSessionResult } from '@hub/shared';
import { apiUrl } from '@/lib/api/config';
import { getBridge } from '@/lib/desktop/bridge';

/**
 * Onde vive o refresh token.
 *
 * Na versao web havia um BFF: o refresh token ficava num cookie HttpOnly e o
 * JavaScript nunca o alcancava. Com static export nao existe mais servidor
 * Next, entao o segredo mudou de lugar - mas nao de nivel de protecao:
 *
 *  - desktop  -> Main Process, cifrado pelo cofre do SO (`safeStorage`).
 *                O renderer so recebe access token de vida curta, em memoria.
 *  - browser  -> apenas memoria, e a sessao morre ao recarregar a pagina.
 *
 * Em nenhum dos dois o refresh token chega ao localStorage: num balcao
 * compartilhado isso equivaleria a deixar a sessao em texto puro no disco.
 */
export interface SessionDriver {
  login(credentials: { email: string; password: string }): Promise<DesktopSessionResult>;
  refresh(): Promise<DesktopSessionResult>;
  logout(): Promise<void>;
  hasStoredSession(): Promise<boolean>;
}

/** Driver do desktop: delega tudo ao processo principal. */
class DesktopSessionDriver implements SessionDriver {
  login(credentials: { email: string; password: string }) {
    return requireBridgeSession().login(credentials);
  }

  refresh() {
    return requireBridgeSession().refresh();
  }

  logout() {
    return requireBridgeSession().logout();
  }

  hasStoredSession() {
    return requireBridgeSession().hasStoredSession();
  }
}

/**
 * Driver de navegador, usado somente em `npm run dev:web`.
 *
 * Mantem o refresh token exclusivamente em memoria: recarregar a aba exige
 * login novamente. E aceitavel para desenvolvimento e evita, de forma
 * deliberada, qualquer persistencia insegura no browser.
 */
class BrowserSessionDriver implements SessionDriver {
  private refreshToken: string | null = null;

  async login(credentials: { email: string; password: string }): Promise<DesktopSessionResult> {
    return this.exchange('/auth/login', credentials);
  }

  async refresh(): Promise<DesktopSessionResult> {
    if (!this.refreshToken) {
      return { ok: false, accessToken: null, expiresIn: null, message: 'Sessao nao encontrada.' };
    }

    return this.exchange('/auth/refresh', { refreshToken: this.refreshToken });
  }

  async logout(): Promise<void> {
    if (this.refreshToken) {
      await fetch(apiUrl('/auth/logout'), {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ refreshToken: this.refreshToken }),
      }).catch(() => undefined);
    }

    this.refreshToken = null;
  }

  hasStoredSession(): Promise<boolean> {
    return Promise.resolve(this.refreshToken !== null);
  }

  private async exchange(path: string, body: unknown): Promise<DesktopSessionResult> {
    try {
      const response = await fetch(apiUrl(path), {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(body),
      });

      if (!response.ok) {
        const error = (await response.json().catch(() => ({}))) as { message?: string };
        this.refreshToken = null;

        return {
          ok: false,
          accessToken: null,
          expiresIn: null,
          message: error.message ?? 'Nao foi possivel entrar.',
        };
      }

      const data = (await response.json()) as {
        accessToken: string;
        refreshToken: string;
        expiresIn: number;
      };

      this.refreshToken = data.refreshToken;

      return { ok: true, accessToken: data.accessToken, expiresIn: data.expiresIn };
    } catch {
      return {
        ok: false,
        accessToken: null,
        expiresIn: null,
        message: 'Nao conseguimos falar com o servico da Plataforma Hub.',
      };
    }
  }
}

function requireBridgeSession() {
  const bridge = getBridge();

  if (!bridge) {
    throw new Error('Ponte do desktop indisponivel.');
  }

  return bridge.session;
}

let driver: SessionDriver | null = null;

export function getSessionDriver(): SessionDriver {
  if (!driver) {
    driver = getBridge() ? new DesktopSessionDriver() : new BrowserSessionDriver();
  }

  return driver;
}
