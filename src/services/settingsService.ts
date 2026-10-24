import { DEFAULT_GLOBAL_BINDINGS } from '../features/shortcuts/shortcutRegistry';
import type { AppSettings } from '../types';

const SETTINGS_KEY = 'cuestage:settings';

export const DEFAULT_SETTINGS: AppSettings = {
  settingsVersion: 1,
  theme: 'system',
  controlScale: 'normal',
  reduceMotion: false,
  masterVolume: 1,
  musicVolume: 0.9,
  sfxVolume: 1,
  fadeInSec: 0.6,
  fadeOutSec: 1.2,
  preloadEffects: true,
  autoAdvanceCues: false,
  showCueScript: true,
  startInLiveMode: false,
  lastProjectId: null,
  showTutorial: true,
  outputDeviceId: null,
  globalBindings: { ...DEFAULT_GLOBAL_BINDINGS },
};

export function loadSettings(): AppSettings {
  if (typeof localStorage === 'undefined') return { ...DEFAULT_SETTINGS };
  try {
    const raw = localStorage.getItem(SETTINGS_KEY);
    if (!raw) return { ...DEFAULT_SETTINGS };
    const parsed = JSON.parse(raw) as Partial<AppSettings>;
    return {
      ...DEFAULT_SETTINGS,
      ...parsed,
      settingsVersion: DEFAULT_SETTINGS.settingsVersion,
      globalBindings: {
        ...DEFAULT_GLOBAL_BINDINGS,
        ...(parsed.globalBindings ?? {}),
      },
    };
  } catch {
    return { ...DEFAULT_SETTINGS };
  }
}

export function saveSettings(settings: AppSettings): void {
  if (typeof localStorage === 'undefined') return;
  try {
    localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
  } catch {
    /* Storage may be unavailable; the app keeps working with defaults. */
  }
}
