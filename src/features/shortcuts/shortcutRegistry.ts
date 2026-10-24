/**
 * Keyboard shortcut handling.
 *
 * Shortcuts are stored as a normalised identifier built from the physical
 * key (`KeyboardEvent.code`) plus the active modifiers, for example
 * `Ctrl+Shift+KeyS` or `Digit1`. Using the physical key keeps the layout
 * consistent with the printed labels of the pads.
 */

import type { GlobalAction } from '../../types';

export interface ShortcutCombo {
  key: string;
  ctrl: boolean;
  shift: boolean;
  alt: boolean;
  meta: boolean;
}

export type { GlobalAction };


export interface GlobalShortcutDefinition {
  action: GlobalAction;
  label: string;
  description: string;
  defaultBinding: string;
}

export const GLOBAL_SHORTCUTS: readonly GlobalShortcutDefinition[] = [
  {
    action: 'toggle-music',
    label: 'Reproducir / pausar música',
    description: 'Arranca o detiene la música principal.',
    defaultBinding: 'Space',
  },
  {
    action: 'stop-all',
    label: 'Detener todo',
    description: 'Corta la música y todos los efectos de CueStage.',
    defaultBinding: 'Escape',
  },
  {
    action: 'next-cue',
    label: 'Siguiente señal',
    description: 'Avanza a la siguiente señal del guion.',
    defaultBinding: 'ArrowRight',
  },
  {
    action: 'previous-cue',
    label: 'Señal anterior',
    description: 'Vuelve a la señal anterior del guion.',
    defaultBinding: 'ArrowLeft',
  },
  {
    action: 'toggle-presentation',
    label: 'Modo presentación',
    description: 'Alterna el modo presentación a pantalla completa.',
    defaultBinding: 'F11',
  },
];

export const DEFAULT_GLOBAL_BINDINGS: Record<GlobalAction, string> =
  GLOBAL_SHORTCUTS.reduce(
    (bindings, definition) => {
      bindings[definition.action] = definition.defaultBinding;
      return bindings;
    },
    {} as Record<GlobalAction, string>,
  );

export function comboFromEvent(event: KeyboardEvent): ShortcutCombo {
  return {
    key: event.code,
    ctrl: event.ctrlKey,
    shift: event.shiftKey,
    alt: event.altKey,
    meta: event.metaKey,
  };
}

export function comboToId(combo: ShortcutCombo): string {
  const parts: string[] = [];
  if (combo.ctrl) parts.push('Ctrl');
  if (combo.alt) parts.push('Alt');
  if (combo.shift) parts.push('Shift');
  if (combo.meta) parts.push('Meta');
  parts.push(combo.key);
  return parts.join('+');
}

export function idToCombo(id: string): ShortcutCombo | null {
  const parts = id.split('+');
  const key = parts.pop();
  if (!key) return null;
  return {
    key,
    ctrl: parts.includes('Ctrl'),
    alt: parts.includes('Alt'),
    shift: parts.includes('Shift'),
    meta: parts.includes('Meta'),
  };
}

const KEY_LABELS: Record<string, string> = {
  Space: 'Espacio',
  Escape: 'Esc',
  Enter: 'Intro',
  NumpadEnter: 'Intro',
  Backspace: 'Retroceso',
  Delete: 'Supr',
  Tab: 'Tab',
  ArrowUp: '↑',
  ArrowDown: '↓',
  ArrowLeft: '←',
  ArrowRight: '→',
  ShiftLeft: 'Mayús',
  ShiftRight: 'Mayús',
  ControlLeft: 'Ctrl',
  ControlRight: 'Ctrl',
  AltLeft: 'Alt',
  AltRight: 'Alt',
  MetaLeft: 'Meta',
  MetaRight: 'Meta',
};

export function formatKey(key: string): string {
  if (KEY_LABELS[key]) return KEY_LABELS[key];
  if (key.startsWith('Key')) return key.slice(3);
  if (key.startsWith('Digit')) return key.slice(5);
  if (key.startsWith('Numpad')) return `Num ${key.slice(6)}`;
  if (key.startsWith('F') && /^F\d+$/.test(key)) return key;
  return key;
}

/** Human readable representation, for example «Ctrl + Shift + S». */
export function formatShortcut(id: string | null): string {
  if (!id) return '—';
  const combo = idToCombo(id);
  if (!combo) return '—';
  const parts: string[] = [];
  if (combo.ctrl) parts.push('Ctrl');
  if (combo.alt) parts.push('Alt');
  if (combo.shift) parts.push('Shift');
  if (combo.meta) parts.push('Meta');
  parts.push(formatKey(combo.key));
  return parts.join(' + ');
}

/**
 * Types of `<input>` where the user is writing text.
 *
 * Sliders, checkboxes, colour pickers and buttons are **not** included: while
 * one of them has the focus the global shortcuts must keep working, otherwise
 * the keyboard stays dead after touching a volume slider.
 */
const TEXT_INPUT_TYPES = new Set([
  'text',
  'search',
  'email',
  'url',
  'tel',
  'password',
  'number',
  'date',
  'datetime-local',
  'month',
  'time',
  'week',
]);

/** True when the user is writing in a field and the shortcuts must be ignored. */
export function isTextEntryTarget(target: EventTarget | null): boolean {
  if (!target || !(target instanceof HTMLElement)) return false;
  const tag = target.tagName;
  if (tag === 'TEXTAREA' || tag === 'SELECT') return true;
  if (tag === 'INPUT') {
    const type = (target as HTMLInputElement).type.toLowerCase();
    return TEXT_INPUT_TYPES.has(type);
  }
  if (target.isContentEditable) return true;
  return false;
}

/** True when the focused control is a volume slider. */
export function isRangeInput(target: EventTarget | null): boolean {
  return target instanceof HTMLInputElement && target.type === 'range';
}

/** Keys that belong to a focused slider instead of to the application. */
export const SLIDER_KEYS = new Set([
  'ArrowUp',
  'ArrowDown',
  'ArrowLeft',
  'ArrowRight',
  'Home',
  'End',
  'PageUp',
  'PageDown',
]);

/** Keys that the browser uses for its own shortcuts and must be preserved. */
const RESERVED_COMBOS = new Set([
  'Ctrl+Shift+I',
  'Ctrl+Shift+J',
  'Ctrl+Shift+C',
  'F12',
  'Ctrl+R',
  'Ctrl+Shift+R',
  'Ctrl+W',
  'Ctrl+Tab',
]);

export function isReservedCombo(id: string): boolean {
  return RESERVED_COMBOS.has(id);
}

export interface ShortcutConflict {
  id: string;
  label: string;
}

export function findConflict(
  id: string,
  pads: { id: string; name: string; shortcut: string | null }[],
  globalBindings: Record<GlobalAction, string>,
  ignorePadId?: string,
): ShortcutConflict | null {
  if (!id) return null;
  const pad = pads.find(
    (entry) => entry.shortcut === id && entry.id !== ignorePadId,
  );
  if (pad) return { id, label: `Pad «${pad.name}»` };

  for (const definition of GLOBAL_SHORTCUTS) {
    if (globalBindings[definition.action] === id) {
      return { id, label: definition.label };
    }
  }
  return null;
}
