import { useEffect, useRef } from 'react';
import { useProjectStore } from '../../stores/projectStore';
import { useSettingsStore } from '../../stores/settingsStore';
import {
  comboFromEvent,
  comboToId,
  isRangeInput,
  isTextEntryTarget,
  SLIDER_KEYS,
  type GlobalAction,
} from './shortcutRegistry';

export interface ShortcutHandlers {
  onToggleMusic?: () => void;
  onStopAll?: () => void;
  onNextCue?: () => void;
  onPreviousCue?: () => void;
  onTogglePresentation?: () => void;
  onTriggerPad?: (padId: string) => void;
  onReleasePad?: (padId: string) => void;
}

/**
 * Binds the keyboard shortcuts of the current screen.
 *
 * The listener is registered once per screen and removed on unmount, so
 * navigating between sections never leaves duplicated handlers behind.
 */
export function useShortcuts(enabled: boolean, handlers: ShortcutHandlers): void {
  const handlersRef = useRef(handlers);

  useEffect(() => {
    handlersRef.current = handlers;
  });

  const heldPads = useRef<Set<string>>(new Set());

  useEffect(() => {
    if (!enabled) return;

    const releaseHeldPads = () => {
      for (const padId of heldPads.current) {
        handlersRef.current.onReleasePad?.(padId);
      }
      heldPads.current.clear();
    };

    const resolvePad = (id: string): string | null => {
      const project = useProjectStore.getState().project;
      if (!project) return null;
      const pad = project.pads.find((entry) => entry.shortcut === id);
      return pad ? pad.id : null;
    };

    const onKeyDown = (event: KeyboardEvent) => {
      // Mientras se escribe en un campo, los atajos globales no se disparan.
      if (isTextEntryTarget(event.target)) return;
      // Un deslizador con el foco se queda con las flechas, pero el resto de
      // las teclas siguen siendo de la aplicación: si no, el teclado «queda
      // muerto» después de mover el volumen.
      if (isRangeInput(event.target) && SLIDER_KEYS.has(event.key)) return;
      if (event.repeat) return;

      const combo = comboFromEvent(event);
      const id = comboToId(combo);
      const project = useProjectStore.getState().project;

      const padId = resolvePad(id);
      if (padId) {
        const pad = project?.pads.find((entry) => entry.id === padId);
        if (pad?.mode === 'hold') {
          event.preventDefault();
          if (!heldPads.current.has(padId)) {
            heldPads.current.add(padId);
            handlersRef.current.onTriggerPad?.(padId);
          }
          return;
        }
        event.preventDefault();
        handlersRef.current.onTriggerPad?.(padId);
        return;
      }

      const action = matchGlobalAction(id);
      if (!action) return;

      switch (action) {
        case 'toggle-music':
          event.preventDefault();
          handlersRef.current.onToggleMusic?.();
          break;
        case 'stop-all':
          event.preventDefault();
          handlersRef.current.onStopAll?.();
          break;
        case 'next-cue':
          event.preventDefault();
          handlersRef.current.onNextCue?.();
          break;
        case 'previous-cue':
          event.preventDefault();
          handlersRef.current.onPreviousCue?.();
          break;
        case 'toggle-presentation':
          event.preventDefault();
          handlersRef.current.onTogglePresentation?.();
          break;
      }
    };

    const onKeyUp = (event: KeyboardEvent) => {
      if (heldPads.current.size === 0) return;
      const id = comboToId(comboFromEvent(event));
      for (const padId of [...heldPads.current]) {
        const project = useProjectStore.getState().project;
        const pad = project?.pads.find((entry) => entry.id === padId);
        if (!pad || pad.shortcut === id) {
          heldPads.current.delete(padId);
          handlersRef.current.onReleasePad?.(padId);
        }
      }
    };

    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('keyup', onKeyUp);
    window.addEventListener('blur', releaseHeldPads);

    return () => {
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('keyup', onKeyUp);
      window.removeEventListener('blur', releaseHeldPads);
      releaseHeldPads();
    };
  }, [enabled]);
}

function matchGlobalAction(id: string): GlobalAction | null {
  const bindings = useSettingsStore.getState().settings.globalBindings;
  for (const [action, binding] of Object.entries(bindings)) {
    if (binding === id) return action as GlobalAction;
  }
  return null;
}
