import type { HardwareDevice, HardwareStatus, ScaleReading } from '@hub/shared';
import type { ScaleAdapter } from './scale.types';

/** Adapter nulo da balanca: contrato pronto, protocolo serial ainda nao. */
export class NoopScaleAdapter implements ScaleAdapter {
  readonly id = 'noop-scale';

  getStatus(): Promise<HardwareStatus> {
    return Promise.resolve({
      availability: 'unsupported',
      message: 'Balanca ainda nao esta disponivel nesta versao.',
      deviceName: null,
    });
  }

  getDevices(): Promise<HardwareDevice[]> {
    return Promise.resolve([]);
  }

  read(): Promise<ScaleReading> {
    return Promise.resolve({
      ok: false,
      weightKg: null,
      stable: false,
      message: 'Nenhuma balanca configurada.',
    });
  }
}
