import type { LucideIcon } from 'lucide-react';
import { cn } from '@/lib/utils';

interface EmptyStateProps {
  icon?: LucideIcon;
  title: string;
  description?: string;
  action?: React.ReactNode;
  className?: string;
}

/**
 * Estado vazio sempre com saida: titulo, contexto e uma acao.
 * Nunca deixamos uma tela vazia sem dizer o que fazer em seguida.
 */
export function EmptyState({
  icon: Icon,
  title,
  description,
  action,
  className,
}: EmptyStateProps) {
  return (
    <div
      className={cn(
        'flex flex-col items-center justify-center gap-3 px-6 py-14 text-center',
        className,
      )}
    >
      {Icon ? (
        <span className="mb-1 flex size-11 items-center justify-center rounded-xl bg-brand-50 text-brand-600">
          <Icon className="size-5" />
        </span>
      ) : null}

      <h3 className="text-base font-semibold text-foreground">{title}</h3>

      {description ? (
        <p className="max-w-md text-sm text-foreground-muted">{description}</p>
      ) : null}

      {action ? <div className="mt-2 flex flex-wrap justify-center gap-2">{action}</div> : null}
    </div>
  );
}
