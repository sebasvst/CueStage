import { cancelAutomation, rampTo, setGain, sliderToGain } from './FadeController';
import type {
  AudioContextHandle,
  DynamicsCompressorHandle,
  GainNodeHandle,
} from './AudioTypes';

/**
 * Mixing graph.
 *
 *   music sources  -> music bus  ┐
 *                                ├-> master out -> safety limiter -> device
 *   effect sources -> sfx bus    ┘
 *
 * Four independent levels are exposed, as required:
 *   1. music bus   — volumen de la música
 *   2. sfx bus     — volumen general de los efectos
 *   3. per-pad gain — volumen individual de cada efecto (owned by PlaybackManager)
 *   4. master out  — volumen general de salida
 */
export class MixerController {
  readonly master: GainNodeHandle;
  readonly music: GainNodeHandle;
  readonly sfx: GainNodeHandle;
  private readonly limiter: DynamicsCompressorHandle;

  private masterTarget = 1;
  private musicTarget = 1;
  private sfxTarget = 1;
  private muted = false;

  constructor(private readonly ctx: AudioContextHandle) {
    this.master = ctx.createGain();
    this.music = ctx.createGain();
    this.sfx = ctx.createGain();
    this.limiter = ctx.createDynamicsCompressor();

    // A gentle limiter: it lowers the risk of digital clipping when many
    // effects overlap. It is NOT an acoustic safety guarantee.
    this.limiter.threshold = -6;
    this.limiter.knee = 6;
    this.limiter.ratio = 6;
    this.limiter.attack = 0.004;
    this.limiter.release = 0.18;

    this.music.connect(this.master);
    this.sfx.connect(this.master);
    this.master.connect(this.limiter);
    this.limiter.connect(ctx.destination);
  }

  get volumes(): { music: number; sfx: number; master: number } {
    return { music: this.musicTarget, sfx: this.sfxTarget, master: this.masterTarget };
  }

  setMusicVolume(value: number, rampSeconds = 0.03): void {
    this.musicTarget = clamp01(value);
    rampTo(this.music.gain, sliderToGain(this.musicTarget), rampSeconds, this.ctx.currentTime);
  }

  setSfxVolume(value: number, rampSeconds = 0.03): void {
    this.sfxTarget = clamp01(value);
    rampTo(this.sfx.gain, sliderToGain(this.sfxTarget), rampSeconds, this.ctx.currentTime);
  }

  setMasterVolume(value: number, rampSeconds = 0.03): void {
    this.masterTarget = clamp01(value);
    if (!this.muted) {
      rampTo(
        this.master.gain,
        sliderToGain(this.masterTarget),
        rampSeconds,
        this.ctx.currentTime,
      );
    }
  }

  /**
   * Emergency path, step 1: silence the output immediately.
   * Sources are stopped afterwards by the playback manager.
   */
  muteImmediate(): void {
    this.muted = true;
    // Any ramp that is already running has to be stopped, otherwise the
    // volume would come back on its own right after the mute.
    cancelAutomation(this.master.gain, this.ctx.currentTime);
    setGain(this.master.gain, 0, this.ctx.currentTime);
  }

  /**
   * Emergency path, step 2: restore the output to the level the user asked for.
   * The ramp avoids an audible jump once the sources are stopped.
   */
  restoreMaster(rampSeconds = 0.06): void {
    this.muted = false;
    rampTo(
      this.master.gain,
      sliderToGain(this.masterTarget),
      rampSeconds,
      this.ctx.currentTime,
    );
  }

  get isMuted(): boolean {
    return this.muted;
  }

  dispose(): void {
    try {
      this.music.disconnect();
      this.sfx.disconnect();
      this.master.disconnect();
      this.limiter.disconnect();
    } catch {
      /* Nodes may already be detached; disposal must never throw. */
    }
  }
}

export function clamp01(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.min(1, Math.max(0, value));
}
