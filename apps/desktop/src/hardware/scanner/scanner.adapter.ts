import type { HardwareActionResult, HardwareDevice, HardwareStatus, ScanEvent } from '@hub/shared';
import { createLogger } from '../../shared/logger';
import type { ScannerAdapter } from './scanner.types';

const log = createLogger('hardware:scanner');

/**
 * Adapter nulo do scanner serial.
 *
 * Leitores HID (a maioria no varejo) continuam funcionando sem nada disto:
 * eles se comportam como teclado e sao capturados pela tela de PDV.
 */
export class NoopScannerAdapter implements ScannerAdapter {
  readonly id = 'noop-scanner';

  private readonly listeners = new Set<(event: ScanEvent) => void>();

  getStatus(): Promise<HardwareStatus> {
    return Promise.resolve({
      availability: 'unsupported',
      message: 'Leitor serial nao esta disponivel. Leitores USB tipo teclado funcionam normalmente.',
      deviceName: null,
    });
  }

  getDevices(): Promise<HardwareDevice[]> {
    return Promise.resolve([]);
  }

  startListening(): Promise<HardwareActionResult> {
    log.info('startListening chamado sem driver configurado');

    return Promise.resolve({
      ok: false,
      message: 'Nenhum leitor serial configurado.',
    });
  }

  stopListening(): Promise<HardwareActionResult> {
    return Promise.resolve({ ok: true, message: 'Nenhuma escuta ativa.' });
  }

  onScan(listener: (event: ScanEvent) => void): () => void {
    this.listeners.add(listener);

    return () => {
      this.listeners.delete(listener);
    };
  }

  /** Usado pelas implementacoes reais para propagar uma leitura. */
  protected emit(event: ScanEvent): void {
    for (const listener of this.listeners) {
      listener(event);
    }
  }
}
