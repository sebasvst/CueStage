import { useState } from 'react';
import { ChevronDown, ChevronUp, CircleCheck, Plus, RotateCcw, Trash2 } from 'lucide-react';
import { useProjectStore } from '../../stores/projectStore';
import { CUE_ACTION_LABELS, type Cue, type CueActionType } from '../../types';

const ACTION_OPTIONS = Object.keys(CUE_ACTION_LABELS) as CueActionType[];

export function CueEditor() {
  const project = useProjectStore((state) => state.project);
  const addCue = useProjectStore((state) => state.addCue);
  const updateCue = useProjectStore((state) => state.updateCue);
  const removeCue = useProjectStore((state) => state.removeCue);
  const moveCue = useProjectStore((state) => state.moveCue);
  const resetCues = useProjectStore((state) => state.resetCues);

  const [selectedId, setSelectedId] = useState<string | null>(null);

  const cues = project?.cues ?? [];
  const pads = project?.pads ?? [];
  const assets = project?.assets ?? [];

  if (!project) return null;

  const selected = cues.find((cue) => cue.id === selectedId) ?? null;

  return (
    <div className="studio-layout">
      <section className="card">
        <div className="card__header">
          <div className="card__heading">
            <h3 className="card__title">La lista de señales</h3>
            <p className="card__description">
              Lo que va pasando en escena, en orden. En «En vivo» la recorrerás a mano.
            </p>
          </div>
          <div className="row">
            <button
              type="button"
              className="btn btn--ghost btn--sm"
              onClick={resetCues}
              disabled={cues.length === 0}
            >
              <RotateCcw size={15} />
              Reiniciar
            </button>
            <button
              type="button"
              className="btn btn--secondary btn--sm"
              onClick={() => {
                const cue = addCue({ name: `Señal ${cues.length + 1}` });
                setSelectedId(cue.id);
              }}
            >
              <Plus size={15} />
              Añadir señal
            </button>
          </div>
        </div>

        {cues.length === 0 ? (
          <p className="card__body field__hint">
            Todavía no hay señales. Añade las tuyas: «Entrada», «Caminata», «Final»…
          </p>
        ) : (
          <div className="cue-rail__list">
            {cues.map((cue, index) => (
              <div key={cue.id} className="cue-item" data-done={cue.executed}>
                <span className="cue-item__index">
                  {cue.executed ? <CircleCheck size={13} /> : index + 1}
                </span>
                <button
                  type="button"
                  className="cue-item__body"
                  style={{ textAlign: 'left' }}
                  onClick={() => setSelectedId(cue.id === selectedId ? null : cue.id)}
                >
                  <span className="cue-item__name">{cue.name}</span>
                  <span className="cue-item__meta">
                    {CUE_ACTION_LABELS[cue.type]}
                    {cue.padId
                      ? ` · ${pads.find((pad) => pad.id === cue.padId)?.name ?? 'pad eliminado'}`
                      : ''}
                    {cue.notes ? ` · ${cue.notes}` : ''}
                  </span>
                </button>
                <div className="pad-editor-row__actions">
                  <button
                    type="button"
                    className="icon-btn"
                    onClick={() => moveCue(cue.id, -1)}
                    disabled={index === 0}
                    aria-label={`Subir ${cue.name}`}
                  >
                    <ChevronUp size={15} />
                  </button>
                  <button
                    type="button"
                    className="icon-btn"
                    onClick={() => moveCue(cue.id, 1)}
                    disabled={index === cues.length - 1}
                    aria-label={`Bajar ${cue.name}`}
                  >
                    <ChevronDown size={15} />
                  </button>
                  <button
                    type="button"
                    className="icon-btn"
                    onClick={() => removeCue(cue.id)}
                    aria-label={`Eliminar ${cue.name}`}
                  >
                    <Trash2 size={15} />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      <section className="card">
        <div className="card__header">
          <div className="card__heading">
            <h3 className="card__title">Ajustes de la señal</h3>
            <p className="card__description">
              {selected ? `«${selected.name}».` : 'Elige una señal de la lista.'}
            </p>
          </div>
        </div>
        <div className="card__body">
          {selected ? (
            <CueForm
              key={selected.id}
              cue={selected}
              pads={pads.map((pad) => ({ id: pad.id, name: pad.name }))}
              assets={assets.map((asset) => ({ id: asset.id, name: asset.name }))}
              onChange={(changes) => updateCue(selected.id, changes)}
            />
          ) : (
            <p className="field__hint">Elige una señal de la lista para editarla.</p>
          )}
        </div>
      </section>
    </div>
  );
}

function CueForm({
  cue,
  pads,
  assets,
  onChange,
}: {
  cue: Cue;
  pads: { id: string; name: string }[];
  assets: { id: string; name: string }[];
  onChange: (changes: Partial<Cue>) => void;
}) {
  const needsPad = cue.type === 'play-pad' || cue.type === 'stop-pad';
  const needsAsset = cue.type === 'play-music';

  return (
    <div className="stack">
      <div className="field">
        <label className="field__label" htmlFor={`cue-name-${cue.id}`}>
          Nombre
        </label>
        <input
          id={`cue-name-${cue.id}`}
          className="input"
          value={cue.name}
          maxLength={120}
          onChange={(event) => onChange({ name: event.target.value })}
        />
      </div>

      <div className="field">
        <label className="field__label" htmlFor={`cue-type-${cue.id}`}>
          Acción
        </label>
        <select
          id={`cue-type-${cue.id}`}
          className="select"
          value={cue.type}
          onChange={(event) => onChange({ type: event.target.value as CueActionType })}
        >
          {ACTION_OPTIONS.map((type) => (
            <option key={type} value={type}>
              {CUE_ACTION_LABELS[type]}
            </option>
          ))}
        </select>
      </div>

      {needsPad ? (
        <div className="field">
          <label className="field__label" htmlFor={`cue-pad-${cue.id}`}>
            Pad
          </label>
          <select
            id={`cue-pad-${cue.id}`}
            className="select"
            value={cue.padId ?? ''}
            onChange={(event) => onChange({ padId: event.target.value || null })}
          >
            <option value="">Selecciona un pad</option>
            {pads.map((pad) => (
              <option key={pad.id} value={pad.id}>
                {pad.name}
              </option>
            ))}
          </select>
        </div>
      ) : null}

      {needsAsset ? (
        <div className="field">
          <label className="field__label" htmlFor={`cue-asset-${cue.id}`}>
            Música principal
          </label>
          <select
            id={`cue-asset-${cue.id}`}
            className="select"
            value={cue.assetId ?? ''}
            onChange={(event) => onChange({ assetId: event.target.value || null })}
          >
            <option value="">La asignada al proyecto</option>
            {assets.map((asset) => (
              <option key={asset.id} value={asset.id}>
                {asset.name}
              </option>
            ))}
          </select>
        </div>
      ) : null}

      {cue.type === 'wait' ? (
        <div className="field">
          <label className="field__label" htmlFor={`cue-wait-${cue.id}`}>
            Espera (segundos)
          </label>
          <input
            id={`cue-wait-${cue.id}`}
            className="input"
            type="number"
            min={0}
            max={3600}
            value={cue.waitSec}
            onChange={(event) =>
              onChange({ waitSec: Math.max(0, Number(event.target.value) || 0) })
            }
          />
        </div>
      ) : null}

      <div className="field">
        <label className="field__label" htmlFor={`cue-notes-${cue.id}`}>
          Notas
        </label>
        <textarea
          id={`cue-notes-${cue.id}`}
          className="textarea"
          value={cue.notes}
          maxLength={500}
          placeholder="Apunte para el operador…"
          onChange={(event) => onChange({ notes: event.target.value })}
        />
      </div>

      <label className="switch">
        <input
          type="checkbox"
          checked={cue.executed}
          onChange={(event) => onChange({ executed: event.target.checked })}
        />
        <span className="switch__control" aria-hidden="true" />
        <span className="switch__label">Marcar como realizada</span>
      </label>
    </div>
  );
}
