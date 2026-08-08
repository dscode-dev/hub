import type {
  HardwareActionResult,
  HardwareStatus,
  ReceiptPayload,
} from '@hub/shared';

/**
 * Contrato da impressora termica.
 *
 * Implementacoes futuras (USB, Serial, ESC/POS) devem satisfazer esta interface
 * sem alterar o preload nem o frontend. Nenhuma biblioteca ESC/POS entra no
 * projeto antes de existir uma impressora real para validar.
 */
export interface PrinterAdapter {
  readonly id: string;
  getStatus(): Promise<HardwareStatus>;
  printReceipt(payload: ReceiptPayload): Promise<HardwareActionResult>;
  /** Pulso na gaveta, normalmente enviado pela propria impressora. */
  openCashDrawer(): Promise<HardwareActionResult>;
}
