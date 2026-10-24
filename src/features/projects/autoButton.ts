import { PAD_COLORS } from './projectFactory';
import { PAD_ICON_NAMES } from '../../components/common/padIcons';
import type { AudioAsset, SoundPad } from '../../types';

/**
 * Automatic creation of sound buttons.
 *
 * Every imported file gets its own button, with a readable name and a stable
 * colour and icon. The operator only has to rename them and, if they want,
 * change the key.
 */

/** Keys offered automatically: 1..9 and 0. */
const SHORTCUT_KEYS = [
  'Digit1',
  'Digit2',
  'Digit3',
  'Digit4',
  'Digit5',
  'Digit6',
  'Digit7',
  'Digit8',
  'Digit9',
  'Digit0',
];

/** Turns `01 - Cancion de entrada.wav` into `Cancion de entrada`. */
export function autoButtonName(fileName: string): string {
  const withoutExtension = fileName.replace(/\.[^.]+$/, '');

  // A leading track number ("01 - ", "02_") is removed when something is left.
  const withoutNumber = withoutExtension.replace(
    /^\s*\d{1,3}\s*[-_.)\]]*\s*/,
    '',
  );
  const base = withoutNumber.length > 0 ? withoutNumber : withoutExtension;

  const cleaned = base
    .replace(/[_\-.]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

  if (!cleaned) return 'Sonido';

  const capitalised = cleaned.charAt(0).toUpperCase() + cleaned.slice(1);
  return capitalised.length > 40 ? `${capitalised.slice(0, 39)}…` : capitalised;
}

/** A stable number for a name, so the same file always gets the same colour. */
function hashOf(value: string): number {
  let hash = 0;
  for (let i = 0; i < value.length; i += 1) {
    hash = (hash << 5) - hash + value.charCodeAt(i);
    hash |= 0;
  }
  return Math.abs(hash);
}

export function autoButtonColor(fileName: string): string {
  const palette = PAD_COLORS.length > 0 ? PAD_COLORS : ['#E0562D'];
  return palette[hashOf(fileName) % palette.length] ?? palette[0]!;
}

export function autoButtonIcon(fileName: string): string {
  const icons = PAD_ICON_NAMES.length > 0 ? PAD_ICON_NAMES : ['zap'];
  return icons[hashOf(fileName) % icons.length] ?? icons[0]!;
}

/** The first digit key that no other button is using. */
export function nextFreeShortcut(pads: SoundPad[]): string | null {
  const used = new Set(pads.map((pad) => pad.shortcut).filter(Boolean));
  return SHORTCUT_KEYS.find((key) => !used.has(key)) ?? null;
}

/** Builds the button that accompanies a freshly imported file. */
export function buildAutoButton(
  asset: AudioAsset,
  pads: SoundPad[],
): Omit<SoundPad, 'id'> {
  return {
    name: autoButtonName(asset.fileName || asset.name),
    assetId: asset.id,
    color: autoButtonColor(asset.fileName || asset.name),
    icon: autoButtonIcon(asset.fileName || asset.name),
    volume: 1,
    shortcut: nextFreeShortcut(pads),
    mode: 'once',
    enabled: true,
  };
}
