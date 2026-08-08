import type {
  HardwareActionResult,
  HardwareDevice,
  HardwareStatus,
  ReceiptPayload,
  ScaleReading,
  ScanEvent,
} from '@hub/shared';
import { getBridge } from './bridge';

/**
 * Camada de hardware do frontend.
 *
 * Componentes React nunca chamam `window.hub.hardware...` diretamente: falam
 * com estas funcoes. Assim a tela de PDV funciona igual no navegador (onde nao
 * ha periferico) e no desktop, e trocar o adapter nao toca em componente algum.
 */

const WEB_STATUS: HardwareStatus = {
  availability: 'unsupported',
  message: 'Periféricos estao disponiveis apenas no aplicativo desktop.',
  deviceName: null,
};

const WEB_ACTION: HardwareActionResult = {
  ok: false,
  message: 'Disponivel apenas no aplicativo desktop.',
};

export const printer = {
  getStatus(): Promise<HardwareStatus> {
    return getBridge()?.hardware.printer.getStatus() ?? Promise.resolve(WEB_STATUS);
  },

  printReceipt(payload: ReceiptPayload): Promise<HardwareActionResult> {
    return getBridge()?.hardware.printer.printReceipt(payload) ?? Promise.resolve(WEB_ACTION);
  },

  openCashDrawer(): Promise<HardwareActionResult> {
    return getBridge()?.hardware.printer.openCashDrawer() ?? Promise.resolve(WEB_ACTION);
  },
};

export const scanner = {
  getStatus(): Promise<HardwareStatus> {
    return getBridge()?.hardware.scanner.getStatus() ?? Promise.resolve(WEB_STATUS);
  },

  getDevices(): Promise<HardwareDevice[]> {
    return getBridge()?.hardware.scanner.getDevices() ?? Promise.resolve([]);
  },

  startListening(): Promise<HardwareActionResult> {
    return getBridge()?.hardware.scanner.startListening() ?? Promise.resolve(WEB_ACTION);
  },

  stopListening(): Promise<HardwareActionResult> {
    return getBridge()?.hardware.scanner.stopListening() ?? Promise.resolve(WEB_ACTION);
  },

  /**
   * Escuta leituras de scanner serial. Leitores HID (que se comportam como
   * teclado) nao passam por aqui - sao capturados como digitacao na tela.
   * Retorna a funcao de cancelamento; no navegador, um no-op.
   */
  onScan(listener: (event: ScanEvent) => void): () => void {
    return getBridge()?.hardware.scanner.onScan(listener) ?? (() => undefined);
  },
};

export const scale = {
  getStatus(): Promise<HardwareStatus> {
    return getBridge()?.hardware.scale.getStatus() ?? Promise.resolve(WEB_STATUS);
  },

  getDevices(): Promise<HardwareDevice[]> {
    return getBridge()?.hardware.scale.getDevices() ?? Promise.resolve([]);
  },

  read(): Promise<ScaleReading> {
    return (
      getBridge()?.hardware.scale.read() ??
      Promise.resolve({
        ok: false,
        weightKg: null,
        stable: false,
        message: 'Disponivel apenas no aplicativo desktop.',
      })
    );
  },
};
