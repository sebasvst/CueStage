import { AudioBufferCache } from './AudioBufferCache';
import { MixerController, clamp01 } from './MixerController';
import { PlaybackManager, type PlaybackEvent } from './PlaybackManager';
import { createNativeAudioContext } from './nativeAudioContext';
import type {
  AudioContextFactory,
  AudioContextHandle,
  AudioContextState,
  DecodedAudioBuffer,
  EngineError,
  EngineSnapshot,
  EngineStatus,
  MusicState,
  PadRuntimeState,
} from './AudioTypes';

export type AudioEngineEvent =
  | { type: 'status'; status: EngineStatus; error: EngineError | null }
  | { type: 'music'; music: MusicState }
  | { type: 'pads'; pads: Record<string, PadRuntimeState> }
  | { type: 'error'; error: EngineError };

export type AudioEngineListener = (event: AudioEngineEvent) => void;

/**
 * The single logical audio engine of the application session.
 *
 * It owns the AudioContext, the mixing graph and the decoded-buffer cache.
 * Everything else (playback, UI state) talks to it through this API.
 */
export class AudioEngine {
  private ctx: AudioContextHandle | null = null;
  private mixer: MixerController | null = null;
  private playbackManager: PlaybackManager | null = null;
  private status: EngineStatus = 'uninitialized';
  private error: EngineError | null = null;
  private readonly cache = new AudioBufferCache();
  private readonly listeners = new Set<AudioEngineListener>();
  private initPromise: Promise<void> | null = null;
  private restoreTimer: ReturnType<typeof setTimeout> | null = null;
  private disposed = false;

  constructor(private readonly factory: AudioContextFactory = createNativeAudioContext) {}

  // ------------------------------------------------------------ lifecycle ---

  async init(): Promise<void> {
    if (this.disposed) {
      throw new Error('El motor de audio ya fue cerrado.');
    }
    if (!this.initPromise) {
      this.initPromise = this.performInit();
    }
    await this.initPromise;
  }

  private async performInit(): Promise<void> {
    this.setStatus('initializing');
    try {
      const ctx = this.factory();
      ctx.onstatechange = (state) => this.handleContextState(state);
      this.ctx = ctx;
      this.mixer = new MixerController(ctx);
      this.playbackManager = new PlaybackManager(
        ctx,
        { music: this.mixer.music, sfx: this.mixer.sfx },
        (event) => this.handlePlaybackEvent(event),
      );
      this.setStatus(ctx.state === 'running' ? 'ready' : 'suspended');
    } catch (cause) {
      const message =
        cause instanceof Error ? cause.message : 'Error desconocido al iniciar el audio.';
      this.error = { message: 'No se pudo iniciar el motor de audio.', detail: message };
      this.setStatus('error');
      throw cause;
    }
  }

  /**
   * Makes sure the context is running. Browsers keep an AudioContext
   * suspended until a user gesture, so this must be called from an input
   * handler the first time the operator interacts with the app.
   */
  async ensureRunning(): Promise<boolean> {
    if (this.disposed) return false;
    try {
      await this.init();
    } catch {
      return false;
    }
    const ctx = this.ctx;
    if (!ctx) return false;
    if (ctx.state === 'suspended') {
      try {
        await ctx.resume();
      } catch {
        return false;
      }
    }
    return ctx.state === 'running';
  }

  async dispose(): Promise<void> {
    if (this.disposed) return;
    this.disposed = true;
    if (this.restoreTimer !== null) {
      clearTimeout(this.restoreTimer);
      this.restoreTimer = null;
    }
    this.playbackManager?.dispose();
    this.mixer?.dispose();
    this.cache.clear();
    const ctx = this.ctx;
    this.ctx = null;
    this.mixer = null;
    this.playbackManager = null;
    this.status = 'closed';
    if (ctx) {
      try {
        await ctx.close();
      } catch {
        /* The context may already be closed. */
      }
    }
  }

  // -------------------------------------------------------------- accessors ---

  get engineStatus(): EngineStatus {
    return this.status;
  }

  get engineError(): EngineError | null {
    return this.error;
  }

  get contextState(): AudioContextState | null {
    return this.ctx?.state ?? null;
  }

  get currentTime(): number {
    return this.ctx?.currentTime ?? 0;
  }

  get bufferCache(): AudioBufferCache {
    return this.cache;
  }

  get isReady(): boolean {
    return this.status === 'ready' || this.status === 'suspended';
  }

  // ---------------------------------------------------------------- events ---

  subscribe(listener: AudioEngineListener): () => void {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }

  private emit(event: AudioEngineEvent): void {
    for (const listener of [...this.listeners]) {
      try {
        listener(event);
      } catch {
        /* A faulty listener must not break the engine. */
      }
    }
  }

  // -------------------------------------------------------------- decoding ---

  async decode(assetId: string, bytes: ArrayBuffer): Promise<DecodedAudioBuffer> {
    const cached = this.cache.get(assetId);
    if (cached) return cached;
    await this.init();
    const ctx = this.ctx;
    if (!ctx) throw new Error('El motor de audio no está disponible.');
    try {
      const buffer = await ctx.decodeAudioData(bytes);
      this.cache.set(assetId, buffer);
      return buffer;
    } catch (cause) {
      const detail = cause instanceof Error ? cause.message : String(cause);
      const error: EngineError = {
        message: 'No se pudo decodificar el archivo de audio.',
        detail,
      };
      this.error = error;
      this.emit({ type: 'error', error });
      throw cause;
    }
  }

  getBuffer(assetId: string): DecodedAudioBuffer | undefined {
    return this.cache.get(assetId);
  }

  releaseBuffer(assetId: string): void {
    this.cache.delete(assetId);
  }

  // ---------------------------------------------------------------- mixing ---

  setMusicVolume(value: number): void {
    this.mixer?.setMusicVolume(clamp01(value));
  }

  setSfxVolume(value: number): void {
    this.mixer?.setSfxVolume(clamp01(value));
  }

  setMasterVolume(value: number): void {
    this.mixer?.setMasterVolume(clamp01(value));
  }

  /** Routes the output to a specific device, when the host supports it. */
  async setOutputDevice(deviceId: string | null): Promise<boolean> {
    const ctx = this.ctx;
    if (!ctx || !ctx.setSinkId) return false;
    try {
      await ctx.setSinkId(deviceId ?? '');
      return true;
    } catch {
      return false;
    }
  }

  get volumes(): { music: number; sfx: number; master: number } {
    return this.mixer?.volumes ?? { music: 1, sfx: 1, master: 1 };
  }

  /** Current position of the main music track, in seconds. */
  get musicPosition(): number {
    return this.playbackManager?.getMusicPosition() ?? 0;
  }

  /** Duration of the main music track, in seconds. */
  get musicDuration(): number {
    return this.playbackManager?.getMusicState().duration ?? 0;
  }

  // -------------------------------------------------------------- playback ---

  get playback(): PlaybackManager {
    if (!this.playbackManager) {
      throw new Error('El motor de audio todavía no se ha inicializado.');
    }
    return this.playbackManager;
  }

  /**
   * Emergency stop.
   *
   * 1. the output is muted instantly (first audible reaction),
   * 2. the music and every effect are stopped,
   * 3. the output level is restored shortly after.
   */
  stopAll(): void {
    const mixer = this.mixer;
    mixer?.muteImmediate();

    const playback = this.playbackManager;
    if (playback) {
      playback.stopMusic();
      playback.stopAllEffects(0);
    }

    if (this.restoreTimer !== null) {
      clearTimeout(this.restoreTimer);
    }
    this.restoreTimer = setTimeout(() => {
      this.restoreTimer = null;
      mixer?.restoreMaster(0.08);
    }, 90);
  }

  getSnapshot(): EngineSnapshot {
    const playback = this.playbackManager;
    return {
      status: this.status,
      error: this.error,
      music: playback?.getMusicState() ?? {
        status: 'idle',
        assetId: null,
        currentTime: 0,
        duration: 0,
        error: null,
      },
      volumes: this.volumes,
      pads: playback?.getPadStates() ?? {},
      activeEffectCount: playback?.getActiveEffectCount() ?? 0,
    };
  }

  // --------------------------------------------------------------- private ---

  private setStatus(status: EngineStatus): void {
    this.status = status;
    this.emit({ type: 'status', status, error: this.error });
  }

  private handleContextState(state: AudioContextState): void {
    if (this.disposed) return;
    if (state === 'running') {
      this.setStatus('ready');
    } else if (state === 'suspended') {
      this.setStatus('suspended');
    } else if (state === 'closed') {
      this.setStatus('closed');
    }
  }

  private handlePlaybackEvent(event: PlaybackEvent): void {
    if (event.type === 'music' && event.music) {
      this.emit({ type: 'music', music: event.music });
    } else if (event.type === 'pads' && event.pads) {
      this.emit({ type: 'pads', pads: event.pads });
    } else if (event.type === 'error' && event.error) {
      this.error = event.error;
      this.emit({ type: 'error', error: event.error });
    }
  }
}
