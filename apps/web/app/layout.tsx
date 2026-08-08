import type { Metadata, Viewport } from 'next';
import { Toaster } from 'sonner';
import { SessionProvider } from '@/components/session/session-provider';
import './globals.css';

export const metadata: Metadata = {
  title: {
    default: 'Plataforma Hub',
    template: '%s · Plataforma Hub',
  },
  description:
    'Plataforma Hub - organize produtos, estoque, clientes, vendas e financeiro do seu negocio em um so lugar.',
};

export const viewport: Viewport = {
  themeColor: '#1665f0',
  width: 'device-width',
  initialScale: 1,
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt-BR">
      <body>
        {/* Sessao resolvida no cliente: com static export nao ha servidor. */}
        <SessionProvider>{children}</SessionProvider>
        <Toaster
          position="bottom-right"
          toastOptions={{
            classNames: {
              toast: 'rounded-lg border border-line bg-white text-sm text-foreground',
            },
          }}
        />
      </body>
    </html>
  );
}
