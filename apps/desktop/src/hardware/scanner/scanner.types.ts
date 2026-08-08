import type { HardwareActionResult, HardwareDevice, HardwareStatus, ScanEvent } from '@hub/shared';

/**
 * Contrato do leitor de codigo de barras.
 *
 * Existem dois modelos no mercado e eles NAO passam pelo mesmo caminho:
 *
 *  - HID / emulacao de teclado: o leitor digita o codigo. Quem trata isso e o
 *    Renderer, capturando teclas na tela de PDV. Nao precisa deste adapter.
 *  - Serial / USB dedicado: exige acesso nativo e vive aqui no Main Process,
 *    emitindo leituras para o Renderer via evento.
 */
export interface ScannerAdapter {
  readonly id: string;
  getStatus(): Promise<HardwareStatus>;
  getDevices(): Promise<HardwareDevice[]>;
  startListening(): Promise<HardwareActionResult>;
  stopListening(): Promise<HardwareActionResult>;
  /** Registra o consumidor das leituras; devolve a funcao de cancelamento. */
  onScan(listener: (event: ScanEvent) => void): () => void;
}
