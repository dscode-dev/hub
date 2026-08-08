'use client';

import { useEffect } from 'react';
import { ErrorState } from '@/components/common/error-state';
import { Button } from '@/components/ui/button';

/** Fronteira de erro da area logada: o shell continua de pe, so o conteudo cai. */
export default function AppError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <ErrorState
      title="Algo deu errado nesta tela"
      description="O problema foi registrado. Voce pode tentar carregar de novo."
      action={
        <Button type="button" onClick={reset}>
          Tentar novamente
        </Button>
      }
    />
  );
}
