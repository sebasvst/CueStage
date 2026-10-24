import type { AutomatableParam } from './AudioTypes';

/**
 * Gain ramps used for fades.
 *
 * All ramps are scheduled on the Web Audio clock, so they are sample accurate
 * and do not depend on the UI thread or on animation frames.
 */

/**
 * Cancels the pending automation, keeping the value that is playing.
 *
 * `cancelScheduledValues` alone does not stop a ramp that has already
 * started: it would keep going and could bring the volume back up right
 * after an emergency mute.
 */
export function cancelAutomation(param: AutomatableParam, now: number): void {
  if (typeof param.cancelAndHoldAtTime === 'function') {
    param.cancelAndHoldAtTime(now);
    return;
  }
  param.cancelScheduledValues(now);
}

/** Applies a value instantly, cancelling any pending automation. */
export function setGain(param: AutomatableParam, value: number, now: number): void {
  cancelAutomation(param, now);
  param.setValueAtTime(value, now);
}

/**
 * Ramp from the current value to `target` over `duration` seconds.
 * A duration of zero applies the value instantly.
 */
export function rampTo(
  param: AutomatableParam,
  target: number,
  duration: number,
  now: number,
): void {
  cancelAutomation(param, now);
  if (duration <= 0) {
    param.setValueAtTime(target, now);
    return;
  }
  param.setValueAtTime(param.value, now);
  param.linearRampToValueAtTime(target, now + duration);
}

/**
 * Fade in from silence to `target` starting at `startTime`.
 * The ramp starts at an explicit silent value so that a fade-in scheduled in
 * the future does not leak the target volume before it begins.
 */
export function fadeIn(
  param: AutomatableParam,
  target: number,
  duration: number,
  startTime: number,
): void {
  cancelAutomation(param, startTime);
  if (duration <= 0) {
    param.setValueAtTime(target, startTime);
    return;
  }
  param.setValueAtTime(0, startTime);
  param.linearRampToValueAtTime(target, startTime + duration);
}

export interface EnvelopeOptions {
  /** Context time at which the source starts. */
  startTime: number;
  /** Remaining duration of the source, in seconds. */
  durationSec: number;
  fadeInSec: number;
  fadeOutSec: number;
  loop: boolean;
}

/**
 * Schedule a complete play envelope (fade in, optional fade out) on a gain
 * parameter. The envelope is expressed in absolute context time, so it stays
 * correct even if the UI thread stalls.
 */
export function scheduleEnvelope(param: AutomatableParam, options: EnvelopeOptions): void {
  const { startTime, durationSec, fadeInSec, fadeOutSec, loop } = options;
  const endTime = startTime + Math.max(0, durationSec);

  cancelAutomation(param, startTime);

  if (fadeInSec > 0) {
    param.setValueAtTime(0, startTime);
    param.linearRampToValueAtTime(1, startTime + fadeInSec);
  } else {
    param.setValueAtTime(1, startTime);
  }

  if (!loop && fadeOutSec > 0 && durationSec > 0) {
    // The fade out never starts before the fade in has finished: otherwise it
    // would overwrite it and the track would start at full volume.
    const fadeOutStart = Math.max(startTime + fadeInSec, endTime - fadeOutSec);
    if (fadeOutStart < endTime) {
      param.setValueAtTime(1, fadeOutStart);
      param.linearRampToValueAtTime(0, endTime);
    }
  }
}

/**
 * Convert a linear 0..1 slider value into a perceptual curve.
 *
 * A plain linear gain makes the bottom half of the slider almost useless, so
 * the curve is applied on the control side while the graph keeps real gains.
 */
export function sliderToGain(slider: number): number {
  const clamped = Math.min(1, Math.max(0, slider));
  return clamped * clamped;
}
