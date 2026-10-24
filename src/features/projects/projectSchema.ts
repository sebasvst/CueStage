import {
  arrayOf,
  boolean,
  enumValues,
  nullable,
  number,
  object,
  string,
  withDefault,
  type Schema,
} from '../../services/schema';
import {
  CUE_ACTION_LABELS,
  PAD_MODES,
  type AudioAsset,
  type AudioFormat,
  type Cue,
  type CueActionType,
  type CueStageProject,
  type ProjectMixerSettings,
  type ProjectPlaybackSettings,
  type SoundPad,
  type ThemePreference,
} from '../../types';

/** Current version of the persisted project format. */
export const CURRENT_FORMAT_VERSION = 1;

const AUDIO_FORMATS: readonly AudioFormat[] = ['wav', 'mp3', 'ogg', 'unknown'];
const CUE_ACTIONS = Object.keys(CUE_ACTION_LABELS) as CueActionType[];
const THEMES: readonly ThemePreference[] = ['light', 'dark', 'system'];

export const assetSchema: Schema<AudioAsset> = object({
  id: string({ min: 1 }),
  name: string({ min: 1, max: 200 }),
  fileName: string({ max: 400 }),
  storage: enumValues(['embedded', 'external'] as const),
  relativePath: nullable(string()),
  absolutePath: nullable(string()),
  format: withDefault(enumValues(AUDIO_FORMATS), () => 'unknown' as AudioFormat),
  durationSec: withDefault(nullable(number({ min: 0 })), () => null),
  sizeBytes: withDefault(nullable(number({ min: 0, integer: true })), () => null),
  addedAt: withDefault(string(), () => new Date().toISOString()),
});

export const padSchema: Schema<SoundPad> = object({
  id: string({ min: 1 }),
  name: string({ min: 1, max: 60 }),
  assetId: nullable(string()),
  color: withDefault(string({ pattern: /^#[0-9a-fA-F]{6}$/ }), () => '#E0562D'),
  icon: withDefault(string({ max: 40 }), () => 'zap'),
  volume: withDefault(number({ min: 0, max: 1 }), () => 1),
  shortcut: nullable(string()),
  mode: withDefault(enumValues(PAD_MODES), () => 'once' as const),
  enabled: withDefault(boolean(), () => true),
});

export const cueSchema: Schema<Cue> = object({
  id: string({ min: 1 }),
  name: string({ min: 1, max: 120 }),
  type: enumValues(CUE_ACTIONS),
  assetId: withDefault(nullable(string()), () => null),
  padId: withDefault(nullable(string()), () => null),
  notes: withDefault(string({ max: 500 }), () => ''),
  waitSec: withDefault(number({ min: 0, max: 3600 }), () => 2),
  executed: withDefault(boolean(), () => false),
});

export const mixerSchema: Schema<ProjectMixerSettings> = object({
  musicVolume: withDefault(number({ min: 0, max: 1 }), () => 0.9),
  sfxVolume: withDefault(number({ min: 0, max: 1 }), () => 1),
  masterVolume: withDefault(number({ min: 0, max: 1 }), () => 1),
});

export const playbackSchema: Schema<ProjectPlaybackSettings> = object({
  loopMusic: withDefault(boolean(), () => false),
  musicFadeInSec: withDefault(number({ min: 0, max: 30 }), () => 0.6),
  musicFadeOutSec: withDefault(number({ min: 0, max: 30 }), () => 1.2),
  stopMusicAtEnd: withDefault(boolean(), () => false),
  autoAdvance: withDefault(boolean(), () => false),
});

export const projectSchema: Schema<CueStageProject> = object({
  formatVersion: withDefault(
    number({ integer: true, min: 1 }),
    () => CURRENT_FORMAT_VERSION,
  ),
  id: string({ min: 1 }),
  name: string({ min: 1, max: 120 }),
  createdAt: string({ min: 1 }),
  updatedAt: string({ min: 1 }),
  musicAssetId: nullable(string()),
  assets: withDefault(arrayOf(assetSchema), () => []),
  pads: withDefault(arrayOf(padSchema), () => []),
  cues: withDefault(arrayOf(cueSchema), () => []),
  mixer: withDefault(mixerSchema, () => ({
    musicVolume: 0.9,
    sfxVolume: 1,
    masterVolume: 1,
  })),
  playback: withDefault(playbackSchema, () => ({
    loopMusic: false,
    musicFadeInSec: 0.6,
    musicFadeOutSec: 1.2,
    stopMusicAtEnd: false,
    autoAdvance: false,
  })),
  theme: withDefault(enumValues(THEMES), () => 'system' as ThemePreference),
});

/**
 * Upgrades a project file written by an older version of the app.
 *
 * Only version 1 exists so far, so this function mostly validates the shape
 * and rejects files coming from a newer, unknown format.
 */
export function migrateProject(raw: unknown): CueStageProject {
  if (typeof raw !== 'object' || raw === null) {
    throw new Error('El archivo de proyecto no contiene un objeto válido.');
  }
  const version = (raw as { formatVersion?: unknown }).formatVersion;
  const numericVersion = typeof version === 'number' ? version : 1;

  if (numericVersion > CURRENT_FORMAT_VERSION) {
    throw new Error(
      `Este proyecto fue creado con una versión más reciente de CueStage (formato ${numericVersion}). Actualiza la aplicación para abrirlo.`,
    );
  }

  return projectSchema.parse(raw);
}
