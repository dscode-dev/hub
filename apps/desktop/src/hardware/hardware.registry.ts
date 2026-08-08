import { NoopPrinterAdapter } from './printer/printer.adapter';
import type { PrinterAdapter } from './printer/printer.types';
import { NoopScaleAdapter } from './scale/scale.adapter';
import type { ScaleAdapter } from './scale/scale.types';
import { NoopScannerAdapter } from './scanner/scanner.adapter';
import type { ScannerAdapter } from './scanner/scanner.types';

/**
 * Ponto unico de resolucao de periferico.
 *
 * Quando existir driver real, a troca acontece so aqui - IPC, preload e
 * frontend continuam iguais porque conversam apenas com as interfaces.
 */
export interface HardwareRegistry {
  printer: PrinterAdapter;
  scanner: ScannerAdapter;
  scale: ScaleAdapter;
}

let registry: HardwareRegistry | null = null;

export function getHardwareRegistry(): HardwareRegistry {
  if (!registry) {
    registry = {
      printer: new NoopPrinterAdapter(),
      scanner: new NoopScannerAdapter(),
      scale: new NoopScaleAdapter(),
    };
  }

  return registry;
}
