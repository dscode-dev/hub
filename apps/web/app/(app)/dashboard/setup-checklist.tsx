import Link from 'next/link';
import { Check } from 'lucide-react';
import { cn } from '@/lib/utils';
import { SETUP_STEP_HREF, SETUP_STEP_LABELS, type SetupStatus } from './types';

/**
 * Checklist de configuracao inicial. Cada item que ja e possivel executar leva
 * direto para a acao; o que depende de modulo futuro fica visivel como "em breve"
 * para que o usuario entenda o caminho completo do produto.
 */
export function SetupChecklist({ setup }: { setup: SetupStatus }) {
  const completed = setup.steps.filter((step) => step.done).length;

  return (
    <section className="rounded-xl border border-line bg-surface p-5 sm:p-6">
      <div className="flex items-baseline justify-between gap-3">
        <h2 className="text-sm font-semibold text-foreground">Configuracao inicial</h2>
        <span className="text-xs text-foreground-subtle tabular">
          {completed} de {setup.steps.length}
        </span>
      </div>

      <div className="mt-3 h-1 overflow-hidden rounded-full bg-line">
        <div
          className="h-full rounded-full bg-brand-600 transition-all"
          style={{ width: `${(completed / setup.steps.length) * 100}%` }}
        />
      </div>

      <ul className="mt-4 flex flex-col gap-1">
        {setup.steps.map((step) => {
          const label = SETUP_STEP_LABELS[step.key];
          const href = step.available ? SETUP_STEP_HREF[step.key] : null;

          const content = (
            <>
              <span
                aria-hidden="true"
                className={cn(
                  'flex size-5 shrink-0 items-center justify-center rounded-md border',
                  step.done
                    ? 'border-success bg-success text-white'
                    : 'border-line-strong bg-surface',
                )}
              >
                {step.done ? <Check className="size-3.5" strokeWidth={3} /> : null}
              </span>

              <span
                className={cn(
                  'text-sm',
                  step.done ? 'text-foreground-subtle line-through' : 'text-foreground',
                )}
              >
                {label}
              </span>

              {!step.available ? (
                <span className="ml-auto text-[10px] font-medium uppercase tracking-wide text-foreground-subtle">
                  em breve
                </span>
              ) : null}
            </>
          );

          return (
            <li key={step.key}>
              {href && !step.done ? (
                <Link
                  href={href}
                  className="flex items-center gap-3 rounded-lg px-2 py-2 transition-colors hover:bg-surface-muted"
                >
                  {content}
                </Link>
              ) : (
                <div className="flex items-center gap-3 px-2 py-2">{content}</div>
              )}
            </li>
          );
        })}
      </ul>
    </section>
  );
}
