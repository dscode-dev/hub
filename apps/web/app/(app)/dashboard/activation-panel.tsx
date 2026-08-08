import type { Route } from 'next';
import Link from 'next/link';
import { ArrowRight, PackagePlus, ShoppingCart, Upload, UserPlus } from 'lucide-react';
import { cn } from '@/lib/utils';
import { SetupChecklist } from './setup-checklist';
import type { SetupStatus } from './types';

interface ActionCard {
  title: string;
  description: string;
  href: Route | null;
  icon: typeof PackagePlus;
}

const ACTIONS: ActionCard[] = [
  {
    title: 'Adicionar produto',
    description: 'Comece pelo que voce vende. Nome e preco ja bastam.',
    href: '/products/new',
    icon: PackagePlus,
  },
  {
    title: 'Importar dados',
    description: 'Traga sua planilha de produtos em CSV.',
    href: '/products/import',
    icon: Upload,
  },
  {
    title: 'Cadastrar cliente',
    description: 'Disponivel no proximo modulo.',
    href: null,
    icon: UserPlus,
  },
  {
    title: 'Registrar uma venda',
    description: 'Disponivel quando o modulo de vendas chegar.',
    href: null,
    icon: ShoppingCart,
  },
];

/**
 * Substitui o dashboard vazio. Em vez de cards com zero, o usuario recebe
 * um caminho claro de ativacao.
 */
export function ActivationPanel({
  greeting,
  setup,
}: {
  greeting: string;
  setup: SetupStatus;
}) {
  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_320px]">
      <div>
        <p className="text-sm text-foreground-muted">Ola, {greeting}</p>
        <h1 className="mt-1 text-2xl font-semibold tracking-tight text-foreground sm:text-3xl">
          Vamos organizar sua operacao.
        </h1>
        <p className="mt-2 max-w-xl text-sm text-foreground-muted">
          Sua conta esta pronta. Comece cadastrando o que voce vende - o resto da plataforma
          se abre a partir dai.
        </p>

        <div className="mt-6 grid gap-3 sm:grid-cols-2">
          {ACTIONS.map((action) => {
            const Icon = action.icon;
            const disabled = action.href === null;

            const card = (
              <div
                className={cn(
                  'flex h-full flex-col gap-2 rounded-xl border p-5 transition-colors',
                  disabled
                    ? 'border-line bg-surface-muted/50'
                    : 'border-line bg-surface hover:border-brand-300 hover:bg-brand-50/50',
                )}
              >
                <span
                  className={cn(
                    'flex size-9 items-center justify-center rounded-lg',
                    disabled ? 'bg-line text-foreground-subtle' : 'bg-brand-50 text-brand-600',
                  )}
                >
                  <Icon className="size-[18px]" />
                </span>

                <span className="flex items-center gap-1.5 text-sm font-medium text-foreground">
                  {action.title}
                  {!disabled ? <ArrowRight className="size-3.5 text-brand-600" /> : null}
                </span>

                <span className="text-xs text-foreground-muted">{action.description}</span>

                {disabled ? (
                  <span className="mt-auto pt-1 text-[10px] font-medium uppercase tracking-wide text-foreground-subtle">
                    em breve
                  </span>
                ) : null}
              </div>
            );

            return action.href ? (
              <Link key={action.title} href={action.href} className="h-full">
                {card}
              </Link>
            ) : (
              <div key={action.title} aria-disabled="true">
                {card}
              </div>
            );
          })}
        </div>
      </div>

      <SetupChecklist setup={setup} />
    </div>
  );
}
