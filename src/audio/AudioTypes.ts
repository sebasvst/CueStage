/**
 * Narrow structural interfaces over the Web Audio API.
 *
 * The real DOM types are far wider than what CueStage needs, and they cannot
 * be instantiated inside a unit test. Every audio component in this app talks
 * to these interfaces only, so the engine can run against:
 *
 *  - the native Web Audio implementation (see `nativeAudioContext.ts`), or
 *  - a deterministic fake used by the test-suite.
 *
 * Keeping this boundary thin is what makes the engine testable without
 * speakers and without pretending that "unit tests" prove real audio output.
 */

import type { PadPlaybackMode } from '../types';

export type { PadPlaybackMode };

export type AudioContextState = 'suspended' | 'running' | 'closed';

/** A parameter that supports scheduled automation (gain, panning, ...). */
export interface AutomatableParam {
  readonly value: number;
  setValueAtTime(value: number, time: number): void;
  linearRampToValueAtTime(value: number, time: number): void;
  exponentialRampToValueAtTime(value: number, time: number): void;
  cancelScheduledValues(time: number): void;
  /**
   * Cancels the pending automation keeping the current value.
   *
   * Without it, a ramp that is already running keeps going and can undo a
   * mute. Not every engine implements it, so it is optional.
   */
  cancelAndHoldAtTime?(time: number): void;
}

/** Minimal view over a decoded audio buffer. */
export interface DecodedAudioBuffer {
  readonly duration: number;
  readonly numberOfChannels: number;
  readonly sampleRate: number;
  readonly length: number;
}

export interface AudioNodeHandle {
  connect(destination: AudioNodeHandle): void;
  disconnect(): void;
}

export interface GainNodeHandle extends AudioNodeHandle {
  readonly gain: AutomatableParam;
}

/** Terminal node (the device output). It accepts connections but has no gain. */
export type DestinationHandle = AudioNodeHandle;

export interface SourceNodeHandle extends AudioNodeHandle {
  buffer: DecodedAudioBuffer | null;
  loop: boolean;
  playbackRate: number;
  start(when?: number, offset?: number): void;
  stop(when?: number): void;
  onended: (() => void) | null;
}

/** Gentle safety limiter used to reduce the chance of digital clipping. */
export interface DynamicsCompressorHandle extends AudioNodeHandle {
  threshold: number;
  knee: number;
  ratio: number;
  attack: number;
  release: number;
}

export interface AudioContextHandle {
  readonly currentTime: number;
  readonly sampleRate: number;
  readonly state: AudioContextState;
  readonly destination: DestinationHandle;
  onstatechange: ((state: AudioContextState) => void) | null;
  createGain(): GainNodeHandle;
  createBufferSource(): SourceNodeHandle;
  createDynamicsCompressor(): DynamicsCompressorHandle;
  decodeAudioData(data: ArrayBuffer): Promise<DecodedAudioBuffer>;
  resume(): Promise<void>;
  suspend(): Promise<void>;
  close(): Promise<void>;
  /** Optional: selects the output device (Chromium 110+). */
  setSinkId?: (deviceId: string) => Promise<void>;
}

export type AudioContextFactory = () => AudioContextHandle;

export type PlaybackStatus = 'idle' | 'loading' | 'playing' | 'paused' | 'error';

export type EngineStatus =
  | 'uninitialized'
  | 'initializing'
  | 'ready'
  | 'suspended'
  | 'closed'
  | 'error';

export interface EngineError {
  message: string;
  detail?: string;
}

export interface MusicState {
  status: PlaybackStatus;
  assetId: string | null;
  currentTime: number;
  duration: number;
  error: EngineError | null;
}

export interface PadRuntimeState {
  active: boolean;
  instanceId: string | null;
  looping: boolean;
}

export interface EngineSnapshot {
  status: EngineStatus;
  error: EngineError | null;
  music: MusicState;
  volumes: { music: number; sfx: number; master: number };
  pads: Record<string, PadRuntimeState>;
  activeEffectCount: number;
}
