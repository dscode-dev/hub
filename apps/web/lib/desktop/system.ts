import { getBridge } from './bridge';

/**
 * Abre um endereco externo.
 *
 * No desktop o Main Process valida o protocolo e delega ao navegador do
 * sistema; no navegador, abre em nova aba. Em nenhum dos casos a janela da
 * aplicacao e substituida por conteudo externo.
 */
export async function openExternal(url: string): Promise<boolean> {
  const bridge = getBridge();

  if (bridge) {
    return bridge.system.openExternal(url);
  }

  window.open(url, '_blank', 'noopener,noreferrer');
  return true;
}

/** Versao da aplicacao desktop; `null` no navegador. */
export async function getAppVersion(): Promise<string | null> {
  return (await getBridge()?.app.getVersion()) ?? null;
}
