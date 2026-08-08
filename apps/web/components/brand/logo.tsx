import { cn } from '@/lib/utils';

/**
 * Marca da Plataforma Hub: camadas empilhadas em isometria, ecoando a ideia de
 * uma operacao organizada em blocos. SVG inline para nao depender de rede nem
 * de otimizacao de imagem.
 */
export function HubMark({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 32 32"
      fill="none"
      aria-hidden="true"
      className={cn('size-8', className)}
    >
      <path d="M16 13.5 29 21 16 28.5 3 21Z" className="fill-brand-900" />
      <path d="M16 8.5 29 16 16 23.5 3 16Z" className="fill-brand-700" />
      <path d="M16 3.5 29 11 16 18.5 3 11Z" className="fill-brand-500" />
      <path d="M16 8.2 20.4 10.7 16 13.2 11.6 10.7Z" className="fill-white/85" />
    </svg>
  );
}

export function HubLogo({
  className,
  showWordmark = true,
}: {
  className?: string;
  showWordmark?: boolean;
}) {
  return (
    <span className={cn('inline-flex items-center gap-2.5', className)}>
      <HubMark />
      {showWordmark ? (
        <span className="text-[15px] font-semibold tracking-tight text-brand-900">
          Plataforma <span className="text-brand-600">Hub</span>
        </span>
      ) : null}
    </span>
  );
}
