import type {
  AudioContextHandle,
  AudioContextState,
  AutomatableParam,
  DecodedAudioBuffer,
  DestinationHandle,
  DynamicsCompressorHandle,
  GainNodeHandle,
  SourceNodeHandle,
} from '../../src/audio/AudioTypes';

/**
 * A deterministic, in-memory implementation of the Web Audio API.
 *
 * It records every automation event so the tests can assert how the fades and
 * the volume changes were scheduled, and it lets the test advance the audio
 * clock to simulate the passage of time.
 */

export class FakeParam implements AutomatableParam {
  value: number;
  readonly events: { type: string; value: number; time: number }[] = [];

  constructor(initial = 1) {
    this.value = initial;
  }

  setValueAtTime(value: number, time: number): void {
    this.value = value;
    this.events.push({ type: 'set', value, time });
  }

  linearRampToValueAtTime(value: number, time: number): void {
    this.value = value;
    this.events.push({ type: 'ramp', value, time });
  }

  exponentialRampToValueAtTime(value: number, time: number): void {
    this.value = value;
    this.events.push({ type: 'exp', value, time });
  }

  cancelScheduledValues(time: number): void {
    this.events.push({ type: 'cancel', value: this.value, time });
  }

  cancelAndHoldAtTime(time: number): void {
    this.events.push({ type: 'hold', value: this.value, time });
  }
}

export class FakeGainNode implements GainNodeHandle {
  readonly gain = new FakeParam(1);
  connected: FakeGainNode | FakeCompressor | null = null;
  disconnected = false;

  connect(destination: FakeGainNode | FakeCompressor): void {
    this.connected = destination;
  }

  disconnect(): void {
    this.connected = null;
    this.disconnected = true;
  }
}

export class FakeCompressor implements DynamicsCompressorHandle {
  threshold = -6;
  knee = 6;
  ratio = 6;
  attack = 0.004;
  release = 0.18;
  connected: FakeGainNode | null = null;

  connect(destination: FakeGainNode): void {
    this.connected = destination;
  }

  disconnect(): void {
    this.connected = null;
  }
}

export class FakeDestination implements DestinationHandle {
  connect(): void {
    throw new Error('El nodo de salida no puede recibir conexiones.');
  }
  disconnect(): void {
    /* noop */
  }
}

export class FakeSourceNode implements SourceNodeHandle {
  buffer: DecodedAudioBuffer | null = null;
  loop = false;
  playbackRate = 1;
  onended: (() => void) | null = null;

  started = false;
  startTime = 0;
  offset = 0;
  stopTime: number | null = null;
  ended = false;
  disconnected = false;
  connected: FakeGainNode | null = null;

  constructor(readonly context: FakeAudioContext) {}

  connect(destination: FakeGainNode): void {
    this.connected = destination;
  }

  disconnect(): void {
    this.connected = null;
    this.disconnected = true;
  }

  start(when = 0, offset = 0): void {
    this.started = true;
    this.startTime = when;
    this.offset = offset;
    this.context.registerSource(this);
  }

  stop(when?: number): void {
    this.stopTime = when ?? this.context.currentTime;
  }
}

export interface FakeAudioContextOptions {
  bufferDuration?: number;
  sampleRate?: number;
  state?: AudioContextState;
}

export class FakeAudioContext implements AudioContextHandle {
  currentTime = 0;
  readonly sampleRate: number;
  state: AudioContextState;
  readonly destination: DestinationHandle = new FakeDestination();

  readonly gains: FakeGainNode[] = [];
  readonly sources: FakeSourceNode[] = [];
  readonly compressors: FakeCompressor[] = [];
  readonly destinationOfContext: FakeGainNode | null = null;

  onstatechange: ((state: AudioContextState) => void) | null = null;

  private readonly bufferDuration: number;
  private master: FakeGainNode | null = null;

  constructor(options: FakeAudioContextOptions = {}) {
    this.bufferDuration = options.bufferDuration ?? 2;
    this.sampleRate = options.sampleRate ?? 48000;
    this.state = options.state ?? 'running';
  }

  createGain(): FakeGainNode {
    const node = new FakeGainNode();
    this.gains.push(node);
    return node;
  }

  createBufferSource(): FakeSourceNode {
    return new FakeSourceNode(this);
  }

  createDynamicsCompressor(): FakeCompressor {
    const node = new FakeCompressor();
    this.compressors.push(node);
    return node;
  }

  async decodeAudioData(_data: ArrayBuffer): Promise<DecodedAudioBuffer> {
    return {
      duration: this.bufferDuration,
      numberOfChannels: 2,
      sampleRate: this.sampleRate,
      length: Math.floor(this.bufferDuration * this.sampleRate),
    };
  }

  async resume(): Promise<void> {
    this.setState('running');
  }

  async suspend(): Promise<void> {
    this.setState('suspended');
  }

  async close(): Promise<void> {
    this.setState('closed');
  }

  async setSinkId(): Promise<void> {
    /* not needed for the tests */
  }

  registerSource(source: FakeSourceNode): void {
    this.sources.push(source);
  }

  /** Moves the audio clock forward and fires the pending `ended` events. */
  advance(seconds: number): void {
    const target = this.currentTime + seconds;
    // Step in small increments so the end of a buffer is detected accurately.
    while (this.currentTime < target) {
      this.currentTime = Math.min(target, this.currentTime + 0.05);
      this.fireEndedEvents();
    }
  }

  private fireEndedEvents(): void {
    for (const source of this.sources) {
      if (!source.started || source.ended) continue;
      if (source.stopTime !== null && this.currentTime >= source.stopTime) {
        source.ended = true;
        source.onended?.();
        continue;
      }
      const duration = source.buffer?.duration ?? 0;
      if (!source.loop && duration > 0) {
        const elapsed = this.currentTime - source.startTime;
        if (source.offset + elapsed >= duration) {
          source.ended = true;
          source.onended?.();
        }
      }
    }
  }

  private setState(state: AudioContextState): void {
    this.state = state;
    this.onstatechange?.(state);
  }

  /** The gain node that feeds the compressor (the master output). */
  get masterGain(): FakeGainNode | null {
    return this.master;
  }

  setMasterGain(node: FakeGainNode): void {
    this.master = node;
  }
}

/** Convenience helper: creates a fake context and returns the engine's pieces. */
export function createFakeContext(
  options: FakeAudioContextOptions = {},
): FakeAudioContext {
  return new FakeAudioContext(options);
}
