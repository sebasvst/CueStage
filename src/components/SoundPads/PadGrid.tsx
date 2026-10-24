import { Square } from 'lucide-react';
import { PadIcon } from '../common/Icon';
import { useAudioStore } from '../../stores/audioStore';
import { formatShortcut } from '../../features/shortcuts/shortcutRegistry';
import type { SoundPad } from '../../types';

interface PadGridProps {
  pads: SoundPad[];
  onTrigger: (pad: SoundPad) => void;
  onRelease: (padId: string) => void;
}

/**
 * The live pad grid.
 *
 * Pads are large and give immediate visual feedback. Pads in "hold" mode
 * release the sound when the pointer is released, when the pointer leaves
 * the pad or when the window loses focus.
 */
export function PadGrid({ pads, onTrigger, onRelease }: PadGridProps) {
  const padStates = useAudioStore((state) => state.pads);

  if (pads.length === 0) {
    return (
      <div className="empty-state">
        <div className="empty-state__icon">
          <PadIcon name="zap" size={22} />
        </div>
        <div className="empty-state__title">Todavía no hay botones de sonido</div>
        <p className="empty-state__text">
          Créalos en «Preparar» y aquí aparecerán listos para lanzar con un toque.
        </p>
      </div>
    );
  }

  return (
    <div className="pad-grid">
      {pads.map((pad) => {
        const state = padStates[pad.id];
        const active = state?.active ?? false;

        return (
          <div key={pad.id} style={{ position: 'relative' }}>
            <button
              type="button"
              className="pad"
              data-active={active}
              style={{ ['--pad-color' as string]: pad.color }}
              disabled={!pad.enabled || !pad.assetId}
              aria-label={`Reproducir ${pad.name}`}
              aria-pressed={active}
              onClick={() => {
                // The click covers the mouse and the keyboard (Enter / Space).
                // In "hold" mode the sound was already started on pointer down.
                if (pad.mode === 'hold') return;
                onTrigger(pad);
              }}
              onPointerDown={(event) => {
                if (pad.mode !== 'hold') return;
                event.preventDefault();
                onTrigger(pad);
              }}
              onPointerUp={() => {
                if (pad.mode === 'hold') onRelease(pad.id);
              }}
              onPointerLeave={() => {
                if (pad.mode === 'hold') onRelease(pad.id);
              }}
              onContextMenu={(event) => {
                if (pad.mode === 'hold') event.preventDefault();
              }}
            >
              <span className="pad__top">
                <span className="pad__icon">
                  <PadIcon name={pad.icon} size={17} />
                </span>
                {pad.shortcut ? (
                  <span className="pad__key">{formatShortcut(pad.shortcut)}</span>
                ) : null}
              </span>
              <span className="pad__name">{pad.name}</span>
              <span className="pad__foot">
                {active ? (
                  <span className="pad__hint">Toca para parar</span>
                ) : (
                  <>
                    <span>
                      {pad.mode === 'loop'
                        ? 'Repetición'
                        : pad.mode === 'hold'
                          ? 'Mantener'
                          : 'Una vez'}
                    </span>
                    <span>{Math.round(pad.volume * 100)} %</span>
                  </>
                )}
              </span>
            </button>

            {active ? (
              <button
                type="button"
                className="pad__stop"
                onClick={() => onRelease(pad.id)}
                aria-label={`Detener ${pad.name}`}
                title="Detener"
              >
                <Square size={12} />
              </button>
            ) : null}
          </div>
        );
      })}
    </div>
  );
}
