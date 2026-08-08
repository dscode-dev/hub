import { HubLogo } from '@/components/brand/logo';

/**
 * Tela de transicao enquanto a sessao e resolvida.
 *
 * Continua a splash nativa do Electron: mesma marca, mesmo fundo branco, sem
 * salto visual entre a janela de boot e a aplicacao.
 */
export function BootScreen({ message = 'Carregando sua operacao...' }: { message?: string }) {
  return (
    <div className="flex min-h-dvh flex-col items-center justify-center gap-5 bg-surface">
      {/* Escala proxima a da tela de login: a transicao entre as duas nao deve
          fazer a marca "saltar" de tamanho. */}
      <HubLogo size="lg" />

      <div className="h-1 w-48 overflow-hidden rounded-full bg-line">
        <div className="h-full w-1/3 animate-[boot-slide_1.25s_ease-in-out_infinite] rounded-full bg-brand-600" />
      </div>

      <p className="text-sm text-foreground-muted">{message}</p>
    </div>
  );
}
