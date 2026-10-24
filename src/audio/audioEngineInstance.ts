import { AudioEngine } from './AudioEngine';

/**
 * The application owns a single logical audio engine.
 *
 * Creating a second AudioContext would multiply the memory usage and could
 * break the browser's "one suspended context" behaviour, so the instance is
 * created lazily and shared by every part of the app.
 */

let engine: AudioEngine | null = null;

export function getAudioEngine(): AudioEngine {
  if (!engine) {
    engine = new AudioEngine();
  }
  return engine;
}

/** Replaces the engine (used by the test-suite). */
export function setAudioEngine(next: AudioEngine | null): void {
  engine = next;
}
