'use client';

import type { Route } from 'next';
import { useRouter } from 'next/navigation';
import { useState, type FormEvent } from 'react';
import { Eye, EyeOff, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Field } from '@/components/ui/field';
import { Input } from '@/components/ui/input';
import { internalRoute } from '@/lib/routes';

interface LoginResult {
  redirectTo: string | null;
}

export function LoginForm({ redirectTo }: { redirectTo: Route }) {
  const router = useRouter();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError(null);
    setSubmitting(true);

    try {
      const response = await fetch('/api/bff/auth/login', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ email, password }),
      });

      const body = (await response.json()) as LoginResult & { message?: string };

      if (!response.ok) {
        setError(body.message ?? 'Nao foi possivel entrar. Tente novamente.');
        setSubmitting(false);
        return;
      }

      // Quem ainda nao concluiu o onboarding vai para ele, nao para o destino salvo.
      router.replace(internalRoute(body.redirectTo, redirectTo));
      router.refresh();
    } catch {
      setError('Sem conexao com o servidor. Verifique sua internet e tente de novo.');
      setSubmitting(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4" noValidate>
      {error ? (
        <p
          role="alert"
          className="rounded-lg bg-danger-surface px-3 py-2 text-sm font-medium text-danger"
        >
          {error}
        </p>
      ) : null}

      <Field label="E-mail" htmlFor="email">
        <Input
          id="email"
          name="email"
          type="email"
          autoComplete="email"
          autoFocus
          required
          placeholder="voce@empresa.com.br"
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          disabled={submitting}
        />
      </Field>

      <Field label="Senha" htmlFor="password">
        <div className="relative">
          <Input
            id="password"
            name="password"
            type={showPassword ? 'text' : 'password'}
            autoComplete="current-password"
            required
            placeholder="Sua senha"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            disabled={submitting}
            className="pr-11"
          />
          <button
            type="button"
            onClick={() => setShowPassword((current) => !current)}
            aria-label={showPassword ? 'Ocultar senha' : 'Mostrar senha'}
            className="absolute right-1 top-1 rounded-md p-2 text-foreground-subtle transition-colors hover:text-foreground"
          >
            {showPassword ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
          </button>
        </div>
      </Field>

      <Button type="submit" width="full" size="lg" disabled={submitting} className="mt-2">
        {submitting ? (
          <>
            <Loader2 className="size-4 animate-spin" />
            Entrando...
          </>
        ) : (
          'Entrar'
        )}
      </Button>
    </form>
  );
}
