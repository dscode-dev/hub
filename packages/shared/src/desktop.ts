/**
 * Contrato da ponte Electron (`window.hub`).
 *
 * Fonte unica de verdade: o preload implementa esta interface e o frontend a
 * consome. Qualquer capability nova precisa aparecer aqui primeiro - o que
 * impede o preload de virar um `invoke(channel, payload)` generico.
 */

export type HardwareAvailability =
  /** Adapter existe e o dispositivo respondeu. */
  | 'ready'
  /** Adapter existe, mas nenhum dispositivo foi configurado ainda. */
  | 'not-configured'
  /** Capability ainda nao implementada nesta versao. */
  | 'unsupported'
  /** Dispositivo configurado, porem sem resposta. */
  | 'error';

export interface HardwareStatus {
  availability: HardwareAvailability;
  /** Mensagem curta, ja em portugues, pronta para exibir ao operador. */
  message: string;
  deviceName?: string | null;
}

export interface HardwareDevice {
  id: string;
  label: string;
  transport: 'usb' | 'serial' | 'network' | 'hid';
}

/** Resultado padrao de uma acao de hardware que ainda pode nao estar disponivel. */
export interface HardwareActionResult {
  ok: boolean;
  message: string;
}

export interface ReceiptLine {
  text: string;
  align?: 'left' | 'center' | 'right';
  bold?: boolean;
  /** Tamanho relativo; o adapter traduz para o comando do fabricante. */
  size?: 'normal' | 'large';
}

export interface ReceiptPayload {
  title: string;
  lines: ReceiptLine[];
  /** Corta o papel ao final da impressao. */
  cut?: boolean;
}

export interface ScaleReading {
  ok: boolean;
  /** Peso em quilogramas. Null quando a leitura falhou. */
  weightKg: number | null;
  stable: boolean;
  message: string;
}

export interface ScanEvent {
  code: string;
  /** Origem da leitura: teclado (HID) ou porta serial/USB dedicada. */
  source: 'hid' | 'serial';
  readAt: string;
}

export type BackendPhase = 'starting' | 'ready' | 'stopped' | 'failed';

export interface BackendStatus {
  phase: BackendPhase;
  baseUrl: string;
  /** Preenchido apenas quando `phase === 'failed'`. */
  detail?: string | null;
}

export interface DesktopSessionUser {
  id: string;
  name: string;
  email: string;
}

/**
 * Sessao devolvida ao renderer.
 *
 * Note que o refresh token NAO aparece aqui: ele fica no processo principal,
 * cifrado em disco. O renderer so recebe o access token de vida curta.
 */
export interface DesktopSessionResult {
  ok: boolean;
  accessToken: string | null;
  expiresIn: number | null;
  message?: string;
}

export interface HubAppApi {
  getVersion(): Promise<string>;
  getPlatform(): Promise<'darwin' | 'win32' | 'linux'>;
}

export interface HubBackendApi {
  /** URL base da API local, disponivel de forma sincrona desde o boot. */
  readonly baseUrl: string;
  getStatus(): Promise<BackendStatus>;
  restart(): Promise<BackendStatus>;
}

export interface HubSessionApi {
  login(credentials: { email: string; password: string }): Promise<DesktopSessionResult>;
  /** Troca o refresh token guardado no main por um novo access token. */
  refresh(): Promise<DesktopSessionResult>;
  logout(): Promise<void>;
  hasStoredSession(): Promise<boolean>;
}

export interface HubPrinterApi {
  getStatus(): Promise<HardwareStatus>;
  printReceipt(payload: ReceiptPayload): Promise<HardwareActionResult>;
  openCashDrawer(): Promise<HardwareActionResult>;
}

export interface HubScannerApi {
  getStatus(): Promise<HardwareStatus>;
  getDevices(): Promise<HardwareDevice[]>;
  startListening(): Promise<HardwareActionResult>;
  stopListening(): Promise<HardwareActionResult>;
  /** Assina leituras vindas de scanner serial. Retorna a funcao de cancelamento. */
  onScan(listener: (event: ScanEvent) => void): () => void;
}

export interface HubScaleApi {
  getStatus(): Promise<HardwareStatus>;
  getDevices(): Promise<HardwareDevice[]>;
  read(): Promise<ScaleReading>;
}

export interface HubSystemApi {
  /** Abre no navegador padrao. Apenas http/https sao aceitos. */
  openExternal(url: string): Promise<boolean>;
}

export interface HubBridge {
  /** Marcador estavel para deteccao de ambiente desktop. */
  readonly isDesktop: true;
  app: HubAppApi;
  backend: HubBackendApi;
  session: HubSessionApi;
  hardware: {
    printer: HubPrinterApi;
    scanner: HubScannerApi;
    scale: HubScaleApi;
  };
  system: HubSystemApi;
}
