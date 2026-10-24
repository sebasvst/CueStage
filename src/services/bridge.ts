/**
 * Detection of the runtime environment.
 *
 * CueStage is a Tauri application, but the interface can also be opened in a
 * plain browser during development. In that case the storage and file
 * services fall back to a browser-only implementation and the UI makes it
 * clear that the desktop features are unavailable.
 */

export function isTauri(): boolean {
  if (typeof window === 'undefined') return false;
  return '__TAURI_INTERNALS__' in window;
}

export function isDesktopRuntime(): boolean {
  return isTauri();
}
