import type {
  AudioContextFactory,
  AudioContextHandle,
  AudioContextState,
  AudioNodeHandle,
  AutomatableParam,
  DecodedAudioBuffer,
  DestinationHandle,
  DynamicsCompressorHandle,
  GainNodeHandle,
  SourceNodeHandle,
} from './AudioTypes';

/**
 * Adapter over the real Web Audio API.
 *
 * It exposes the narrow `AudioContextHandle` contract used by the rest of the
 * application, so the same engine code can run against a fake context during
 * unit tests.
 */

const NATIVE = Symbol('cuestage.nativeNode');

interface NativeBacked {
  [NATIVE]: AudioNode;
}

function nativeOf(handle: AudioNodeHandle): AudioNode {
  const backed = handle as unknown as Partial<NativeBacked>;
  if (!backed[NATIVE]) {
    throw new Error('Nodo de audio no válido: no pertenece al contexto nativo.');
  }
  return backed[NATIVE];
}

const nativeBuffers = new WeakMap<object, AudioBuffer>();

class NativeGainNode implements GainNodeHandle {
  readonly [NATIVE]: AudioNode;

  constructor(private readonly node: GainNode) {
    this[NATIVE] = node;
  }

  get gain(): AutomatableParam {
    return this.node.gain;
  }

  connect(destination: AudioNodeHandle): void {
    this.node.connect(nativeOf(destination));
  }

  disconnect(): void {
    this.node.disconnect();
  }
}

class NativeDestinationNode implements DestinationHandle {
  readonly [NATIVE]: AudioNode;

  constructor(private readonly node: AudioNode) {
    this[NATIVE] = node;
  }

  connect(): void {
    throw new Error('El nodo de salida no puede recibir conexiones.');
  }

  disconnect(): void {
    this.node.disconnect();
  }
}

class NativeCompressorNode implements DynamicsCompressorHandle {
  readonly [NATIVE]: AudioNode;

  constructor(private readonly node: DynamicsCompressorNode) {
    this[NATIVE] = node;
  }

  get threshold(): number {
    return this.node.threshold.value;
  }
  set threshold(value: number) {
    this.node.threshold.value = value;
  }
  get knee(): number {
    return this.node.knee.value;
  }
  set knee(value: number) {
    this.node.knee.value = value;
  }
  get ratio(): number {
    return this.node.ratio.value;
  }
  set ratio(value: number) {
    this.node.ratio.value = value;
  }
  get attack(): number {
    return this.node.attack.value;
  }
  set attack(value: number) {
    this.node.attack.value = value;
  }
  get release(): number {
    return this.node.release.value;
  }
  set release(value: number) {
    this.node.release.value = value;
  }

  connect(destination: AudioNodeHandle): void {
    this.node.connect(nativeOf(destination));
  }

  disconnect(): void {
    this.node.disconnect();
  }
}

class NativeSourceNode implements SourceNodeHandle {
  readonly [NATIVE]: AudioNode;
  private decoded: DecodedAudioBuffer | null = null;

  constructor(private readonly node: AudioBufferSourceNode) {
    this[NATIVE] = node;
  }

  get buffer(): DecodedAudioBuffer | null {
    return this.decoded;
  }

  set buffer(value: DecodedAudioBuffer | null) {
    this.decoded = value;
  }

  get loop(): boolean {
    return this.node.loop;
  }
  set loop(value: boolean) {
    this.node.loop = value;
  }

  get playbackRate(): number {
    return this.node.playbackRate.value;
  }
  set playbackRate(value: number) {
    this.node.playbackRate.value = value;
  }

  get onended(): (() => void) | null {
    return this.node.onended ? () => this.node.onended?.(new Event('ended')) : null;
  }

  set onended(handler: (() => void) | null) {
    this.node.onended = handler ? () => handler() : null;
  }

  connect(destination: AudioNodeHandle): void {
    this.node.connect(nativeOf(destination));
  }

  disconnect(): void {
    this.node.disconnect();
  }

  start(when?: number, offset?: number): void {
    const nativeBuffer = this.decoded ? nativeBuffers.get(this.decoded) : undefined;
    if (nativeBuffer) {
      this.node.buffer = nativeBuffer;
    }
    this.node.start(when, offset);
  }

  stop(when?: number): void {
    this.node.stop(when);
  }
}

class NativeAudioContext implements AudioContextHandle {
  constructor(private readonly ctx: AudioContext) {}

  get currentTime(): number {
    return this.ctx.currentTime;
  }

  get sampleRate(): number {
    return this.ctx.sampleRate;
  }

  get state(): AudioContextState {
    return this.ctx.state as AudioContextState;
  }

  get destination(): DestinationHandle {
    return new NativeDestinationNode(this.ctx.destination);
  }

  get onstatechange(): ((state: AudioContextState) => void) | null {
    return this.ctx.onstatechange
      ? () => this.ctx.onstatechange?.(new Event('statechange'))
      : null;
  }

  set onstatechange(handler: ((state: AudioContextState) => void) | null) {
    this.ctx.onstatechange = handler ? () => handler(this.ctx.state as AudioContextState) : null;
  }

  createGain(): GainNodeHandle {
    return new NativeGainNode(this.ctx.createGain());
  }

  createBufferSource(): SourceNodeHandle {
    return new NativeSourceNode(this.ctx.createBufferSource());
  }

  createDynamicsCompressor(): DynamicsCompressorHandle {
    return new NativeCompressorNode(this.ctx.createDynamicsCompressor());
  }

  async decodeAudioData(data: ArrayBuffer): Promise<DecodedAudioBuffer> {
    const decoded = await this.ctx.decodeAudioData(data);
    nativeBuffers.set(decoded, decoded);
    return decoded;
  }

  async resume(): Promise<void> {
    await this.ctx.resume();
  }

  async suspend(): Promise<void> {
    await this.ctx.suspend();
  }

  async close(): Promise<void> {
    await this.ctx.close();
  }

  async setSinkId(deviceId: string): Promise<void> {
    const withSink = this.ctx as AudioContext & {
      setSinkId?: (id: string) => Promise<void>;
    };
    if (typeof withSink.setSinkId !== 'function') {
      throw new Error('Este motor de audio no permite elegir el dispositivo de salida.');
    }
    await withSink.setSinkId(deviceId);
  }
}

function resolveWindow(): Window | undefined {
  return typeof window === 'undefined' ? undefined : window;
}

/** Factory backed by the browser/WebView implementation. */
export const createNativeAudioContext: AudioContextFactory = () => {
  const win = resolveWindow() as
    | (Window & {
        AudioContext?: typeof AudioContext;
        webkitAudioContext?: typeof AudioContext;
      })
    | undefined;

  const Ctor = win?.AudioContext ?? win?.webkitAudioContext;

  if (!Ctor) {
    throw new Error(
      'Este entorno no soporta Web Audio API. CueStage necesita un motor de audio disponible.',
    );
  }

  return new NativeAudioContext(new Ctor());
};
