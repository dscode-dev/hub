import type { HardwareActionResult, HardwareStatus, ReceiptPayload } from '@hub/shared';
import { createLogger } from '../../shared/logger';
import type { PrinterAdapter } from './printer.types';

const log = createLogger('hardware:printer');

/**
 * Adapter nulo: responde de forma previsivel enquanto nao ha driver real.
 *
 * Manter um stub que devolve `unsupported` (em vez de lancar) permite que a
 * tela de PDV seja construida e testada antes de existir hardware na mesa.
 */
export class NoopPrinterAdapter implements PrinterAdapter {
  readonly id = 'noop-printer';

  getStatus(): Promise<HardwareStatus> {
    return Promise.resolve({
      availability: 'unsupported',
      message: 'Impressao termica ainda nao esta disponivel nesta versao.',
      deviceName: null,
    });
  }

  printReceipt(payload: ReceiptPayload): Promise<HardwareActionResult> {
    log.info('printReceipt chamado sem driver configurado', { title: payload.title });

    return Promise.resolve({
      ok: false,
      message: 'Nenhuma impressora configurada.',
    });
  }

  openCashDrawer(): Promise<HardwareActionResult> {
    log.info('openCashDrawer chamado sem driver configurado');

    return Promise.resolve({
      ok: false,
      message: 'Nenhuma gaveta configurada.',
    });
  }
}
