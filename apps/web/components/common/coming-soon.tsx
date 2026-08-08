import Link from 'next/link';
import type { LucideIcon } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { PageHeader } from './page-header';

/**
 * Modulo previsto mas ainda nao implementado.
 *
 * Preferimos uma pagina honesta a esconder o item do menu: o usuario entende o
 * alcance do produto e nao fica procurando uma funcao que "sumiu".
 */
export function ComingSoon({
  title,
  description,
  icon: Icon,
  bullets,
}: {
  title: string;
  description: string;
  icon: LucideIcon;
  bullets: string[];
}) {
  return (
    <div>
      <PageHeader title={title} description={description} />

      <div className="rounded-xl border border-line bg-surface p-8 sm:p-10">
        <span className="flex size-11 items-center justify-center rounded-xl bg-brand-50 text-brand-600">
          <Icon className="size-5" />
        </span>

        <h2 className="mt-4 text-base font-semibold text-foreground">Em construcao</h2>
        <p className="mt-1 max-w-xl text-sm text-foreground-muted">
          Este modulo entra em breve. A base ja esta preparada para ele.
        </p>

        <ul className="mt-5 flex flex-col gap-2">
          {bullets.map((bullet) => (
            <li key={bullet} className="flex items-start gap-2 text-sm text-foreground-muted">
              <span className="mt-1.5 size-1.5 shrink-0 rounded-full bg-brand-400" />
              {bullet}
            </li>
          ))}
        </ul>

        <div className="mt-6">
          <Button asChild variant="secondary">
            <Link href="/products">Ir para produtos</Link>
          </Button>
        </div>
      </div>
    </div>
  );
}
