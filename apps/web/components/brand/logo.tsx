import { cn } from '@/lib/utils';

/**
 * Marca da Plataforma Hub: camadas empilhadas em isometria, ecoando a ideia de
 * uma operacao organizada em blocos. SVG inline para nao depender de rede nem
 * de otimizacao de imagem, e para escalar sem perda em qualquer tamanho.
 */
export function HubMark({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 32 32" fill="none" aria-hidden="true" className={cn('size-8', className)}>
      <path d="M16 13.5 29 21 16 28.5 3 21Z" className="fill-brand-900" />
      <path d="M16 8.5 29 16 16 23.5 3 16Z" className="fill-brand-700" />
      <path d="M16 3.5 29 11 16 18.5 3 11Z" className="fill-brand-500" />
      <path d="M16 8.2 20.4 10.7 16 13.2 11.6 10.7Z" className="fill-white/85" />
    </svg>
  );
}

export type HubLogoSize = 'sm' | 'md' | 'lg' | 'xl';

/**
 * Escalas fixas em vez de tamanho livre: mantem a marca consistente entre
 * header, onboarding e telas de entrada, onde ela ganha mais presenca.
 */
const SIZES: Record<HubLogoSize, { gap: string; mark: string; text: string }> = {
  sm: { gap: 'gap-2', mark: 'size-7', text: 'text-sm' },
  md: { gap: 'gap-2.5', mark: 'size-8', text: 'text-[15px]' },
  lg: { gap: 'gap-3', mark: 'size-11', text: 'text-xl' },
  xl: { gap: 'gap-4', mark: 'size-16', text: 'text-[32px]' },
};

export function HubLogo({
  className,
  showWordmark = true,
  size = 'md',
}: {
  className?: string;
  showWordmark?: boolean;
  size?: HubLogoSize;
}) {
  const scale = SIZES[size];

  return (
    <span className={cn('inline-flex items-center', scale.gap, className)}>
      <HubMark className={scale.mark} />
      {showWordmark ? (
        <span className={cn('font-semibold tracking-tight text-brand-900', scale.text)}>
          Plataforma <span className="text-brand-600">Hub</span>
        </span>
      ) : null}
    </span>
  );
}
