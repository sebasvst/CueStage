import { ChevronDown, ChevronUp, CircleCheck, ListOrdered } from 'lucide-react';
import { CUE_ACTION_LABELS, type Cue, type SoundPad } from '../../types';

interface CueRailProps {
  cues: Cue[];
  pads: SoundPad[];
  activeCueId: string | null;
  onExecute: (cue: Cue) => void;
  onNext: () => void;
  onPrevious: () => void;
}

export function CueRail({
  cues,
  pads,
  activeCueId,
  onExecute,
  onNext,
  onPrevious,
}: CueRailProps) {
  if (cues.length === 0) {
    return (
      <div className="cue-rail">
        <div className="cue-rail__header">
          <span className="cue-rail__title">La lista de señales</span>
        </div>
        <p className="card__body field__hint">
          Todavía no hay señales. Añádelas en «Preparar» para tener la actuación ordenada.
        </p>
      </div>
    );
  }

  const activeIndex = cues.findIndex((cue) => cue.id === activeCueId);

  return (
    <div className="cue-rail">
      <div className="cue-rail__header">
        <span className="cue-rail__title row" style={{ gap: 'var(--space-2)' }}>
          <ListOrdered size={16} />
          La lista de señales
        </span>
        <span className="row" style={{ gap: 'var(--space-1)' }}>
          <button
            type="button"
            className="icon-btn"
            onClick={onPrevious}
            disabled={activeIndex <= 0}
            aria-label="Señal anterior"
            title="Señal anterior"
          >
            <ChevronUp size={16} />
          </button>
          <button
            type="button"
            className="icon-btn"
            onClick={onNext}
            disabled={activeIndex < 0 || activeIndex >= cues.length - 1}
            aria-label="Siguiente señal"
            title="Siguiente señal"
          >
            <ChevronDown size={16} />
          </button>
        </span>
      </div>

      <div className="cue-rail__list">
        {cues.map((cue, index) => {
          const pad = cue.padId ? pads.find((entry) => entry.id === cue.padId) : undefined;
          return (
            <button
              key={cue.id}
              type="button"
              className="cue-item"
              data-active={cue.id === activeCueId}
              data-done={cue.executed}
              onClick={() => onExecute(cue)}
            >
              <span className="cue-item__index">
                {cue.executed ? <CircleCheck size={13} /> : index + 1}
              </span>
              <span className="cue-item__body">
                <span className="cue-item__name">{cue.name}</span>
                <span className="cue-item__meta">
                  {CUE_ACTION_LABELS[cue.type]}
                  {pad ? ` · ${pad.name}` : ''}
                  {cue.notes ? ` · ${cue.notes}` : ''}
                </span>
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
