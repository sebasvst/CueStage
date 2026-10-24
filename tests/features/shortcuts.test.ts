import { describe, expect, it } from 'vitest';
import {
  comboFromEvent,
  comboToId,
  DEFAULT_GLOBAL_BINDINGS,
  findConflict,
  formatKey,
  formatShortcut,
  idToCombo,
  isRangeInput,
  isReservedCombo,
  isTextEntryTarget,
} from '../../src/features/shortcuts/shortcutRegistry';

function keyboardEvent(init: Partial<KeyboardEventInit> & { code: string }) {
  return new KeyboardEvent('keydown', init);
}

describe('shortcut registry', () => {
  it('builds an identifier from the physical key and the modifiers', () => {
    const id = comboToId(
      comboFromEvent(keyboardEvent({ code: 'KeyS', ctrlKey: true, shiftKey: true })),
    );
    expect(id).toBe('Ctrl+Shift+KeyS');
  });

  it('keeps the order of the modifiers stable', () => {
    const id = comboToId(
      comboFromEvent(
        keyboardEvent({ code: 'KeyS', shiftKey: true, ctrlKey: true, altKey: true }),
      ),
    );
    expect(id).toBe('Ctrl+Alt+Shift+KeyS');
  });

  it('round trips an identifier', () => {
    const combo = idToCombo('Ctrl+Shift+Digit1');
    expect(combo).toEqual({
      key: 'Digit1',
      ctrl: true,
      alt: false,
      shift: true,
      meta: false,
    });
  });

  it('formats the shortcut for the interface', () => {
    expect(formatShortcut('Space')).toBe('Espacio');
    expect(formatShortcut('Digit1')).toBe('1');
    expect(formatShortcut('KeyA')).toBe('A');
    expect(formatShortcut('Escape')).toBe('Esc');
    expect(formatShortcut('Ctrl+Shift+KeyS')).toBe('Ctrl + Shift + S');
    expect(formatShortcut(null)).toBe('—');
  });

  it('formats the individual keys', () => {
    expect(formatKey('ArrowLeft')).toBe('←');
    expect(formatKey('F11')).toBe('F11');
    expect(formatKey('Numpad5')).toBe('Num 5');
  });

  it('detects that the operator is writing in a field', () => {
    const input = document.createElement('input');
    const textarea = document.createElement('textarea');
    const div = document.createElement('div');
    expect(isTextEntryTarget(input)).toBe(true);
    expect(isTextEntryTarget(textarea)).toBe(true);
    expect(isTextEntryTarget(div)).toBe(false);
    expect(isTextEntryTarget(null)).toBe(false);
  });

  it('does not treat a volume slider as a text field', () => {
    // Un deslizador no es un campo donde se escriba: si se tratara como tal,
    // el teclado se quedaría muerto después de mover el volumen.
    const range = document.createElement('input');
    range.type = 'range';
    expect(isTextEntryTarget(range)).toBe(false);
    expect(isRangeInput(range)).toBe(true);

    const checkbox = document.createElement('input');
    checkbox.type = 'checkbox';
    expect(isTextEntryTarget(checkbox)).toBe(false);
    expect(isRangeInput(checkbox)).toBe(false);

    const search = document.createElement('input');
    search.type = 'search';
    expect(isTextEntryTarget(search)).toBe(true);
  });

  it('detects a shortcut used by two pads', () => {
    const pads = [
      { id: 'pad-1', name: 'Paso', shortcut: 'Digit1' },
      { id: 'pad-2', name: 'Risa', shortcut: 'Digit2' },
    ];
    const conflict = findConflict('Digit1', pads, DEFAULT_GLOBAL_BINDINGS);
    expect(conflict?.label).toBe('Pad «Paso»');
  });

  it('ignores the pad that is being edited', () => {
    const pads = [{ id: 'pad-1', name: 'Paso', shortcut: 'Digit1' }];
    const conflict = findConflict(
      'Digit1',
      pads,
      DEFAULT_GLOBAL_BINDINGS,
      'pad-1',
    );
    expect(conflict).toBeNull();
  });

  it('detects a shortcut used by a global action', () => {
    const conflict = findConflict('Space', [], DEFAULT_GLOBAL_BINDINGS);
    expect(conflict?.label).toBe('Reproducir / pausar música');
  });

  it('reserves the shortcuts used by the browser and the developer tools', () => {
    expect(isReservedCombo('F12')).toBe(true);
    expect(isReservedCombo('Ctrl+Shift+I')).toBe(true);
    expect(isReservedCombo('Digit1')).toBe(false);
  });

  it('ships sensible defaults', () => {
    expect(DEFAULT_GLOBAL_BINDINGS['toggle-music']).toBe('Space');
    expect(DEFAULT_GLOBAL_BINDINGS['stop-all']).toBe('Escape');
  });
});
