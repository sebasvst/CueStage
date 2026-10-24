/**
 * Domain model of CueStage.
 *
 * These types describe the persisted project format and the runtime state of
 * the application. They are intentionally free of any framework or platform
 * dependency so they can be reused by the audio engine, the stores and the
 * persistence layer.
 */

export type AudioFormat = 'wav' | 'mp3' | 'ogg' | 'unknown';

export type AssetStorage = 'embedded' | 'external';

/** A single audio file referenced by the project. */
export interface AudioAsset {
  id: string;
  /** Name shown in the interface. */
  name: string;
  /** Original file name, kept for reference. */
  fileName: string;
  storage: AssetStorage;
  /** Path relative to the project folder (`assets/...`) for embedded files. */
  relativePath: string | null;
  /** Absolute path on disk (project folder for embedded, original for external). */
  absolutePath: string | null;
  format: AudioFormat;
  durationSec: number | null;
  sizeBytes: number | null;
  addedAt: string;
}

/** How a pad behaves when it is triggered. */
export type PadPlaybackMode = 'once' | 'loop' | 'hold';

export const PAD_MODES: readonly PadPlaybackMode[] = ['once', 'loop', 'hold'];

export const PAD_MODE_LABELS: Record<PadPlaybackMode, string> = {
  once: 'Una vez',
  loop: 'Repetición',
  hold: 'Mantener pulsado',
};

/** A configurable sound pad. */
export interface SoundPad {
  id: string;
  name: string;
  assetId: string | null;
  /** Hexadecimal colour used for the pad. */
  color: string;
  /** Name of the Lucide icon displayed on the pad. */
  icon: string;
  /** Individual gain applied to this pad, 0..1. */
  volume: number;
  /** Normalised keyboard shortcut, e.g. `Digit1`. */
  shortcut: string | null;
  mode: PadPlaybackMode;
  enabled: boolean;
}

/** The kind of action a cue performs. */
export type CueActionType =
  | 'play-music'
  | 'pause-music'
  | 'resume-music'
  | 'stop-music'
  | 'play-pad'
  | 'stop-pad'
  | 'stop-all'
  | 'wait';

export const CUE_ACTION_LABELS: Record<CueActionType, string> = {
  'play-music': 'Reproducir música',
  'pause-music': 'Pausar música',
  'resume-music': 'Reanudar música',
  'stop-music': 'Detener música',
  'play-pad': 'Disparar pad',
  'stop-pad': 'Detener pad',
  'stop-all': 'Detener todo',
  wait: 'Esperar',
};

/** One entry of the show script. */
export interface Cue {
  id: string;
  name: string;
  type: CueActionType;
  assetId: string | null;
  padId: string | null;
  notes: string;
  /** Duration of the wait, in seconds. */
  waitSec: number;
  /** Runtime flag: the cue has already been performed. */
  executed: boolean;
}

export interface ProjectMixerSettings {
  musicVolume: number;
  sfxVolume: number;
  masterVolume: number;
}

export interface ProjectPlaybackSettings {
  loopMusic: boolean;
  musicFadeInSec: number;
  musicFadeOutSec: number;
  /** Stop the main music when the last cue of the script finishes. */
  stopMusicAtEnd: boolean;
  /** Automatic advance through the script. Disabled by default. */
  autoAdvance: boolean;
}

export type ThemePreference = 'light' | 'dark' | 'system';

/** The persisted project format. */
export interface CueStageProject {
  formatVersion: number;
  id: string;
  name: string;
  createdAt: string;
  updatedAt: string;
  musicAssetId: string | null;
  assets: AudioAsset[];
  pads: SoundPad[];
  cues: Cue[];
  mixer: ProjectMixerSettings;
  playback: ProjectPlaybackSettings;
  theme: ThemePreference;
}

/** Application-level settings, stored separately from the projects. */
export interface AppSettings {
  settingsVersion: number;
  theme: ThemePreference;
  controlScale: 'compact' | 'normal' | 'large';
  reduceMotion: boolean;
  masterVolume: number;
  musicVolume: number;
  sfxVolume: number;
  fadeInSec: number;
  fadeOutSec: number;
  preloadEffects: boolean;
  autoAdvanceCues: boolean;
  showCueScript: boolean;
  startInLiveMode: boolean;
  lastProjectId: string | null;
  /** Muestra la guía paso a paso mientras se prepara la presentación. */
  showTutorial: boolean;
  /** Identificador del dispositivo de salida, si el motor lo permite. */
  outputDeviceId: string | null;
  /** Bindings of the application level keyboard actions. */
  globalBindings: Record<GlobalAction, string>;
}

export interface ProjectSummary {
  id: string;
  name: string;
  createdAt: string;
  updatedAt: string;
  path: string;
  assetCount: number;
  padCount: number;
  hasMusic: boolean;
}

export type AppSection = 'inicio' | 'estudio' | 'en-vivo' | 'configuracion';

/** Application level keyboard actions that are not bound to a specific pad. */
export type GlobalAction =
  | 'toggle-music'
  | 'stop-all'
  | 'next-cue'
  | 'previous-cue'
  | 'toggle-presentation';


export const APP_SECTIONS: readonly AppSection[] = [
  'inicio',
  'estudio',
  'en-vivo',
  'configuracion',
];

/**
 * Names of the sections.
 *
 * The wording is deliberately plain: someone who has never opened the app
 * should understand where to go without any explanation.
 */
export const SECTION_LABELS: Record<AppSection, string> = {
  inicio: 'Proyectos',
  estudio: 'Preparar',
  'en-vivo': 'En vivo',
  configuracion: 'Ajustes',
};

/** Short explanation shown under each section name. */
export const SECTION_HINTS: Record<AppSection, string> = {
  inicio: 'Crea y abre presentaciones',
  estudio: 'Prepara la música y los sonidos',
  'en-vivo': 'Actúa con un solo clic',
  configuracion: 'Aspecto, sonido y teclado',
};
