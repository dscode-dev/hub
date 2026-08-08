'use client';

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import type { SessionDto, SetupStatusDto } from '@hub/shared';
import { apiClient } from '@/lib/api/client';
import {
  clearAccessToken,
  setAccessToken,
  setSessionLostHandler,
  refreshAccessToken,
} from '@/lib/auth/access-token';
import { getSessionDriver } from '@/lib/auth/session-driver';

/**
 * Estado de sessao da aplicacao.
 *
 * Substitui o que antes era resolvido no servidor (middleware + Server
 * Components). Com static export tudo acontece no cliente: ao abrir o app,
 * tentamos restaurar a sessao a partir do refresh token guardado pelo Main
 * Process e so entao decidimos entre login, onboarding e dashboard.
 */

export type SessionPhase = 'loading' | 'authenticated' | 'anonymous';

interface SessionContextValue {
  phase: SessionPhase;
  session: SessionDto | null;
  /**
   * true enquanto a instalacao nao tiver um usuario responsavel.
   * `null` enquanto a consulta nao respondeu.
   */
  setupRequired: boolean | null;
  login(credentials: { email: string; password: string }): Promise<{ ok: boolean; message?: string }>;
  logout(): Promise<void>;
  /** Recarrega usuario e organizacao (ex.: apos concluir o onboarding). */
  reload(): Promise<void>;
}

const SessionContext = createContext<SessionContextValue | null>(null);

export function SessionProvider({ children }: { children: React.ReactNode }) {
  const [phase, setPhase] = useState<SessionPhase>('loading');
  const [session, setSession] = useState<SessionDto | null>(null);
  const [setupRequired, setSetupRequired] = useState<boolean | null>(null);

  const loadSession = useCallback(async (): Promise<boolean> => {
    try {
      const current = await apiClient.get<SessionDto>('/auth/me');
      setSession(current);
      setPhase('authenticated');

      return true;
    } catch {
      setSession(null);
      setPhase('anonymous');

      return false;
    }
  }, []);

  // Restauracao da sessao no boot da janela.
  useEffect(() => {
    let cancelled = false;

    const restore = async () => {
      /*
       * Antes de qualquer coisa: esta instalacao ja tem dono? Sem isso a tela
       * de login apareceria numa maquina onde ainda nao existe nenhum usuario.
       */
      try {
        const status = await apiClient.get<SetupStatusDto>('/setup/status');

        if (cancelled) {
          return;
        }

        setSetupRequired(status.required);

        if (status.required) {
          setPhase('anonymous');
          return;
        }
      } catch {
        // Backend indisponivel: seguimos para o fluxo normal, que mostrara o
        // erro de conexao em vez de travar o boot numa tela vazia.
        if (!cancelled) {
          setSetupRequired(false);
        }
      }

      const driver = getSessionDriver();

      if (!(await driver.hasStoredSession())) {
        if (!cancelled) {
          setPhase('anonymous');
        }
        return;
      }

      const token = await refreshAccessToken();

      if (cancelled) {
        return;
      }

      if (!token) {
        setPhase('anonymous');
        return;
      }

      await loadSession();
    };

    void restore();

    return () => {
      cancelled = true;
    };
  }, [loadSession]);

  // Sessao perdida durante o uso (refresh recusado pelo backend).
  useEffect(() => {
    setSessionLostHandler(() => {
      setSession(null);
      setPhase('anonymous');
    });

    return () => setSessionLostHandler(null);
  }, []);

  const login = useCallback(
    async (credentials: { email: string; password: string }) => {
      const result = await getSessionDriver().login(credentials);

      if (!result.ok || !result.accessToken) {
        return { ok: false, message: result.message ?? 'Nao foi possivel entrar.' };
      }

      setAccessToken(result.accessToken);
      // Houve login: por construcao a instalacao tem dono.
      setSetupRequired(false);
      const loaded = await loadSession();

      return loaded
        ? { ok: true }
        : { ok: false, message: 'Entramos, mas nao conseguimos carregar seus dados.' };
    },
    [loadSession],
  );

  const logout = useCallback(async () => {
    await getSessionDriver().logout();
    clearAccessToken();
    setSession(null);
    setPhase('anonymous');
  }, []);

  const value = useMemo<SessionContextValue>(
    () => ({
      phase,
      session,
      setupRequired,
      login,
      logout,
      reload: () => loadSession().then(() => undefined),
    }),
    [phase, session, setupRequired, login, logout, loadSession],
  );

  return <SessionContext.Provider value={value}>{children}</SessionContext.Provider>;
}

export function useSession(): SessionContextValue {
  const context = useContext(SessionContext);

  if (!context) {
    throw new Error('useSession precisa estar dentro de <SessionProvider>.');
  }

  return context;
}
