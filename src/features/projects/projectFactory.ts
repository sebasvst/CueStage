import { createUuid } from '../../utils/id';
import type { Cue, CueActionType, CueStageProject, SoundPad } from '../../types';

/** Palette offered for the pads. Kept neutral so the accent colour stands out. */
export const PAD_COLORS: readonly string[] = [
  '#E0562D',
  '#D9483B',
  '#E08A2D',
  '#C9A227',
  '#6AA84F',
  '#2E9E8F',
  '#3A87C4',
  '#4B62C0',
  '#6B5BC9',
  '#A054A8',
  '#C2557A',
  '#7A8590',
];

/** Lucide icons that can be assigned to a pad. */
export const PAD_ICONS: readonly string[] = [
  'zap',
  'drum',
  'bell',
  'sparkles',
  'droplet',
  'flame',
  'wind',
  'footprints',
  'gavel',
  'star',
  'heart',
  'megaphone',
  'ghost',
  'rabbit',
  'cloud',
  'triangle-alert',
];

export function createEmptyProject(name: string): CueStageProject {
  const now = new Date().toISOString();
  return {
    formatVersion: 1,
    id: createUuid(),
    name: name.trim() || 'Presentación sin título',
    createdAt: now,
    updatedAt: now,
    musicAssetId: null,
    assets: [],
    pads: [],
    cues: [],
    mixer: {
      musicVolume: 0.9,
      sfxVolume: 1,
      masterVolume: 1,
    },
    playback: {
      loopMusic: false,
      musicFadeInSec: 0.6,
      musicFadeOutSec: 1.2,
      stopMusicAtEnd: false,
      autoAdvance: false,
    },
    theme: 'system',
  };
}

export function createPad(partial: Partial<SoundPad> = {}): SoundPad {
  return {
    id: partial.id ?? createUuid(),
    name: partial.name ?? 'Nuevo pad',
    assetId: partial.assetId ?? null,
    color: partial.color ?? PAD_COLORS[0] ?? '#E0562D',
    icon: partial.icon ?? 'zap',
    volume: partial.volume ?? 1,
    shortcut: partial.shortcut ?? null,
    mode: partial.mode ?? 'once',
    enabled: partial.enabled ?? true,
  };
}

export function createCue(partial: Partial<Cue> = {}): Cue {
  return {
    id: partial.id ?? createUuid(),
    name: partial.name ?? 'Nueva señal',
    type: partial.type ?? ('play-pad' as CueActionType),
    assetId: partial.assetId ?? null,
    padId: partial.padId ?? null,
    notes: partial.notes ?? '',
    waitSec: partial.waitSec ?? 2,
    executed: partial.executed ?? false,
  };
}
