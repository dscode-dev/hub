import type { HardwareDevice, HardwareStatus, ScaleReading } from '@hub/shared';

/**
 * Contrato da balanca.
 *
 * Cada fabricante tem um protocolo serial proprio; o adapter isola isso para
 * que a tela de PDV so precise pedir "qual o peso agora".
 */
export interface ScaleAdapter {
  readonly id: string;
  getStatus(): Promise<HardwareStatus>;
  getDevices(): Promise<HardwareDevice[]>;
  /** Leitura pontual do peso estavel. */
  read(): Promise<ScaleReading>;
}
