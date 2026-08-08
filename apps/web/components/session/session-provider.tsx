'use client';

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import type { SessionDto } from '@hub/shared';
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
  login(credentials: { email: string; password: string }): Promise<{ ok: boolean; message?: string }>;
  logout(): Promise<void>;
  /** Recarrega usuario e organizacao (ex.: apos concluir o onboarding). */
  reload(): Promise<void>;
}

const SessionContext = createContext<SessionContextValue | null>(null);

export function SessionProvider({ children }: { children: React.ReactNode }) {
  const [phase, setPhase] = useState<SessionPhase>('loading');
  const [session, setSession] = useState<SessionDto | null>(null);

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
    () => ({ phase, session, login, logout, reload: () => loadSession().then(() => undefined) }),
    [phase, session, login, logout, loadSession],
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
