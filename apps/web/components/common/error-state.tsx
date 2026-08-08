import { AlertTriangle } from 'lucide-react';
import { cn } from '@/lib/utils';

interface ErrorStateProps {
  title?: string;
  description?: string;
  action?: React.ReactNode;
  className?: string;
}

/**
 * Erro em linguagem de usuario final, nunca stack trace.
 * Sempre acompanhado de um caminho de saida.
 */
export function ErrorState({
  title = 'Nao conseguimos carregar estes dados',
  description = 'A conexao pode ter falhado. Tente novamente em alguns instantes.',
  action,
  className,
}: ErrorStateProps) {
  return (
    <div
      className={cn(
        'flex flex-col items-center justify-center gap-3 rounded-xl border border-danger-surface bg-danger-surface/40 px-6 py-12 text-center',
        className,
      )}
      role="alert"
    >
      <span className="flex size-11 items-center justify-center rounded-xl bg-danger-surface text-danger">
        <AlertTriangle className="size-5" />
      </span>

      <h3 className="text-base font-semibold text-foreground">{title}</h3>
      <p className="max-w-md text-sm text-foreground-muted">{description}</p>

      {action ? <div className="mt-1">{action}</div> : null}
    </div>
  );
}
