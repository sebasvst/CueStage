import { createId } from '../utils/id';
import { rampTo, scheduleEnvelope, sliderToGain } from './FadeController';
import { clamp01 } from './MixerController';
import type {
  AudioContextHandle,
  DecodedAudioBuffer,
  EngineError,
  GainNodeHandle,
  MusicState,
  PadPlaybackMode,
  PadRuntimeState,
  PlaybackStatus,
  SourceNodeHandle,
} from './AudioTypes';

export interface PlaybackEvent {
  type: 'music' | 'pads' | 'error';
  music?: MusicState;
  pads?: Record<string, PadRuntimeState>;
  error?: EngineError;
}

export interface MusicPlayOptions {
  assetId: string;
  buffer: DecodedAudioBuffer;
  offset?: number;
  loop?: boolean;
  fadeInSec?: number;
  fadeOutSec?: number;
}

export interface EffectPlayOptions {
  padId: string;
  assetId: string;
  buffer: DecodedAudioBuffer;
  volume: number;
  mode: PadPlaybackMode;
  fadeInSec?: number;
}

interface EffectInstance {
  id: string;
  padId: string;
  assetId: string;
  source: SourceNodeHandle;
  gain: GainNodeHandle;
  startedAt: number;
  stopping: boolean;
}

const DEFAULT_EFFECT_FADE_IN = 0.012;

/** Fade applied to the previous voice when a pad is triggered again. */
const RETRIGGER_FADE_SECONDS = 0.015;

/**
 * Owns every playing source: the main music track and the live effects.
 *
 * Responsibilities:
 *  - one music source at a time (play / pause / resume / seek / stop)
 *  - many simultaneous effect sources, each with its own gain node
 *  - deterministic teardown so a finished playback leaves no references behind
 */
export class PlaybackManager {
  private musicSource: SourceNodeHandle | null = null;
  private musicGain: GainNodeHandle | null = null;
  private musicBuffer: DecodedAudioBuffer | null = null;
  private musicAnchorTime = 0;
  private musicOffset = 0;
  private musicDuration = 0;
  private musicAssetId: string | null = null;
  private musicStatus: PlaybackStatus = 'idle';
  private musicError: EngineError | null = null;
  private musicLoop = false;
  private musicFadeOutSec = 0;

  private readonly effects = new Map<string, EffectInstance>();
  private readonly padInstances = new Map<string, string>();

  constructor(
    private readonly ctx: AudioContextHandle,
    private readonly buses: { music: GainNodeHandle; sfx: GainNodeHandle },
    private readonly emit: (event: PlaybackEvent) => void,
  ) {}

  // ---------------------------------------------------------------- music ---

  getMusicState(): MusicState {
    return {
      status: this.musicStatus,
      assetId: this.musicAssetId,
      currentTime: this.getMusicPosition(),
      duration: this.musicDuration,
      error: this.musicError,
    };
  }

  getMusicPosition(): number {
    if (this.musicStatus === 'playing' && this.musicSource) {
      const elapsed = this.ctx.currentTime - this.musicAnchorTime;
      const raw = this.musicOffset + elapsed;
      if (this.musicLoop && this.musicDuration > 0) {
        return raw % this.musicDuration;
      }
      return Math.min(raw, this.musicDuration);
    }
    return this.musicOffset;
  }

  playMusic(options: MusicPlayOptions): void {
    this.teardownMusic();

    const now = this.ctx.currentTime;
    const offset = clampOffset(options.offset ?? 0, options.buffer.duration);
    const loop = options.loop ?? false;
    const fadeInSec = options.fadeInSec ?? 0;
    const fadeOutSec = options.fadeOutSec ?? 0;

    const gain = this.ctx.createGain();
    gain.connect(this.buses.music);

    const source = this.ctx.createBufferSource();
    source.buffer = options.buffer;
    source.loop = loop;
    source.connect(gain);

    scheduleEnvelope(gain.gain, {
      startTime: now,
      durationSec: Math.max(0, options.buffer.duration - offset),
      fadeInSec,
      fadeOutSec,
      loop,
    });

    source.onended = () => this.handleMusicEnded(source);

    this.musicSource = source;
    this.musicGain = gain;
    this.musicBuffer = options.buffer;
    this.musicAnchorTime = now;
    this.musicOffset = offset;
    this.musicDuration = options.buffer.duration;
    this.musicAssetId = options.assetId;
    this.musicLoop = loop;
    this.musicFadeOutSec = fadeOutSec;
    this.musicError = null;
    this.musicStatus = 'playing';

    source.start(now, offset);
    this.emitMusic();
  }

  pauseMusic(): void {
    if (this.musicStatus !== 'playing') return;
    const position = this.getMusicPosition();
    this.teardownMusic();
    this.musicOffset = position;
    this.musicStatus = 'paused';
    this.emitMusic();
  }

  resumeMusic(): void {
    if (this.musicStatus !== 'paused') return;
    const assetId = this.musicAssetId;
    const buffer = this.musicBuffer;
    if (!assetId || !buffer) {
      this.musicStatus = 'idle';
      this.emitMusic();
      return;
    }
    this.playMusic({
      assetId,
      buffer,
      offset: this.musicOffset,
      loop: this.musicLoop,
      fadeInSec: 0,
      fadeOutSec: this.musicFadeOutSec,
    });
  }

  stopMusic(): void {
    this.teardownMusic();
    this.musicOffset = 0;
    this.musicStatus = 'idle';
    this.musicError = null;
    this.emitMusic();
  }

  seekMusic(seconds: number): void {
    const target = clampOffset(seconds, this.musicDuration);
    const wasPlaying = this.musicStatus === 'playing';
    const assetId = this.musicAssetId;
    const buffer = this.musicBuffer;

    if (!assetId || !buffer) {
      this.musicOffset = target;
      this.emitMusic();
      return;
    }

    if (!wasPlaying) {
      this.musicOffset = target;
      this.emitMusic();
      return;
    }

    this.playMusic({
      assetId,
      buffer,
      offset: target,
      loop: this.musicLoop,
      fadeInSec: 0,
      fadeOutSec: this.musicFadeOutSec,
    });
  }

  private handleMusicEnded(source: SourceNodeHandle): void {
    if (this.musicSource !== source) return; // a newer source took over
    const wasLooping = this.musicLoop;
    this.teardownMusic();
    this.musicOffset = wasLooping ? 0 : this.musicDuration;
    this.musicStatus = 'idle';
    this.emitMusic();
  }

  private teardownMusic(): void {
    if (this.musicSource) {
      this.musicSource.onended = null;
      try {
        this.musicSource.stop();
      } catch {
        /* Already stopped. */
      }
      try {
        this.musicSource.disconnect();
      } catch {
        /* Already disconnected. */
      }
      this.musicSource = null;
    }
    if (this.musicGain) {
      try {
        this.musicGain.disconnect();
      } catch {
        /* Already disconnected. */
      }
      this.musicGain = null;
    }
  }

  // --------------------------------------------------------------- effects ---

  /**
   * Starts an effect. Any previous instance of the same pad is faded out
   * first so repeated presses never stack sources on top of each other.
   */
  triggerPad(options: EffectPlayOptions): string {
    const previousId = this.padInstances.get(options.padId);
    if (previousId) {
      // The previous voice is faded out (a hard cut would click) and the pad
      // is immediately bound to the new instance, so repeated presses never
      // stack several full-volume sources on top of each other.
      this.stopEffect(previousId, RETRIGGER_FADE_SECONDS);
      this.padInstances.delete(options.padId);
    }
    return this.playEffect(options);
  }

  playEffect(options: EffectPlayOptions): string {
    const now = this.ctx.currentTime;
    const id = createId('fx');
    // The slider follows a perceptual curve, so the bottom half is usable.
    const volume = sliderToGain(clamp01(options.volume));

    const gain = this.ctx.createGain();
    gain.connect(this.buses.sfx);

    const source = this.ctx.createBufferSource();
    source.buffer = options.buffer;
    source.loop = options.mode === 'loop';
    source.connect(gain);

    const fadeIn = options.fadeInSec ?? DEFAULT_EFFECT_FADE_IN;
    if (fadeIn > 0) {
      gain.gain.setValueAtTime(0, now);
      gain.gain.linearRampToValueAtTime(volume, now + fadeIn);
    } else {
      gain.gain.setValueAtTime(volume, now);
    }

    source.onended = () => this.releaseEffect(id);

    const instance: EffectInstance = {
      id,
      padId: options.padId,
      assetId: options.assetId,
      source,
      gain,
      startedAt: now,
      stopping: false,
    };

    this.effects.set(id, instance);
    this.padInstances.set(options.padId, id);

    try {
      source.start(now);
    } catch (error) {
      // If the source cannot start, the instance must not stay registered or
      // the pad would look active forever.
      this.releaseEffect(id);
      throw error;
    }
    this.emitPads();
    return id;
  }

  stopEffect(instanceId: string, fadeSeconds = 0.05): void {
    const instance = this.effects.get(instanceId);
    if (!instance || instance.stopping) return;
    instance.stopping = true;

    const now = this.ctx.currentTime;
    if (fadeSeconds > 0) {
      rampTo(instance.gain.gain, 0, fadeSeconds, now);
      try {
        instance.source.stop(now + fadeSeconds);
      } catch {
        this.releaseEffect(instanceId);
        return;
      }
    } else {
      try {
        instance.source.stop();
      } catch {
        /* Already stopped. */
      }
      this.releaseEffect(instanceId);
    }
    this.emitPads();
  }

  /** Stops the effect currently bound to a pad (used by hold mode). */
  stopPad(padId: string, fadeSeconds = 0.04): void {
    const instanceId = this.padInstances.get(padId);
    if (instanceId) this.stopEffect(instanceId, fadeSeconds);
  }

  stopAllEffects(fadeSeconds = 0): void {
    for (const instance of [...this.effects.values()]) {
      this.stopEffect(instance.id, fadeSeconds);
    }
    this.padInstances.clear();
    this.emitPads();
  }

  private releaseEffect(instanceId: string): void {
    const instance = this.effects.get(instanceId);
    if (!instance) return;
    this.effects.delete(instanceId);
    if (this.padInstances.get(instance.padId) === instanceId) {
      this.padInstances.delete(instance.padId);
    }
    try {
      instance.source.onended = null;
      instance.source.disconnect();
    } catch {
      /* Already disconnected. */
    }
    try {
      instance.gain.disconnect();
    } catch {
      /* Already disconnected. */
    }
    this.emitPads();
  }

  getPadStates(): Record<string, PadRuntimeState> {
    const states: Record<string, PadRuntimeState> = {};
    for (const [padId, instanceId] of this.padInstances) {
      const instance = this.effects.get(instanceId);
      // A sound that is fading out is not active any more: the operator has
      // already paused it.
      const active = instance !== undefined && !instance.stopping;
      states[padId] = {
        active,
        instanceId: instance ? instance.id : null,
        looping: instance?.source.loop ?? false,
      };
    }
    return states;
  }

  getActiveEffectCount(): number {
    let count = 0;
    for (const instance of this.effects.values()) {
      // Instances that are fading out are no longer counted as active voices.
      if (!instance.stopping) count += 1;
    }
    return count;
  }

  isPadActive(padId: string): boolean {
    const instanceId = this.padInstances.get(padId);
    if (!instanceId) return false;
    const instance = this.effects.get(instanceId);
    return instance !== undefined && !instance.stopping;
  }

  /** Called when the buffer of a playing music track becomes unavailable. */
  setMusicBuffer(buffer: DecodedAudioBuffer | null): void {
    this.musicBuffer = buffer;
  }

  // ----------------------------------------------------------------- misc ---

  dispose(): void {
    this.teardownMusic();
    for (const instance of [...this.effects.values()]) {
      try {
        instance.source.onended = null;
        instance.source.stop();
      } catch {
        /* Already stopped. */
      }
      try {
        instance.source.disconnect();
      } catch {
        /* Already disconnected. */
      }
      try {
        instance.gain.disconnect();
      } catch {
        /* Already disconnected. */
      }
    }
    this.effects.clear();
    this.padInstances.clear();
  }

  private emitMusic(): void {
    this.emit({ type: 'music', music: this.getMusicState() });
  }

  private emitPads(): void {
    this.emit({ type: 'pads', pads: this.getPadStates() });
  }
}

function clampOffset(value: number, duration: number): number {
  if (!Number.isFinite(value) || value < 0) return 0;
  if (duration <= 0) return 0;
  return Math.min(value, Math.max(0, duration - 0.001));
}
