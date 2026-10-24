import { useEffect, useState } from 'react';
import {
  ChevronDown,
  ChevronUp,
  Copy,
  Keyboard,
  Play,
  Plus,
  Trash2,
  TriangleAlert,
} from 'lucide-react';
import { PadIcon } from '../../components/common/Icon';
import { PAD_ICON_NAMES } from '../../components/common/padIcons';
import { PAD_COLORS } from '../projects/projectFactory';
import { audioController } from '../live-mode/audioController';
import { Slider } from '../../components/common/Slider';
import { useProjectStore } from '../../stores/projectStore';
import { useSettingsStore } from '../../stores/settingsStore';
import { useUiStore } from '../../stores/uiStore';
import { PAD_MODE_LABELS, PAD_MODES, type SoundPad } from '../../types';
import {
  comboFromEvent,
  comboToId,
  findConflict,
  formatShortcut,
} from '../shortcuts/shortcutRegistry';

export function PadEditor() {
  const project = useProjectStore((state) => state.project);
  const addPad = useProjectStore((state) => state.addPad);
  const updatePad = useProjectStore((state) => state.updatePad);
  const removePad = useProjectStore((state) => state.removePad);
  const duplicatePad = useProjectStore((state) => state.duplicatePad);
  const movePad = useProjectStore((state) => state.movePad);

  const [selectedId, setSelectedId] = useState<string | null>(null);

  const pads = project?.pads ?? [];
  const assets = project?.assets ?? [];

  if (!project) return null;

  const selected = pads.find((pad) => pad.id === selectedId) ?? null;

  return (
    <div className="stack">
      <section className="card">
        <div className="card__header">
          <div className="card__heading">
            <h3 className="card__title">Los botones de sonido</h3>
            <p className="card__description">
              Cada botón lanza un archivo. En «En vivo» los verás grandes y podrás
              tocarlos o usar su tecla.
            </p>
          </div>
          <button
            type="button"
            className="btn btn--secondary btn--sm"
            onClick={() => {
              const pad = addPad({ name: `Sonido ${pads.length + 1}` });
              setSelectedId(pad.id);
            }}
          >
            <Plus size={15} />
            Añadir un sonido
          </button>
        </div>

        {pads.length === 0 ? (
          <p className="card__body field__hint">
            Todavía no hay botones. Añade uno y elígele un archivo de los de al lado.
          </p>
        ) : (
          <div className="pad-editor-list">
            {pads.map((pad, index) => {
              const asset = assets.find((entry) => entry.id === pad.assetId);
              return (
                <div key={pad.id} className="pad-editor-row">
                  <span
                    className="pad-editor-row__swatch"
                    style={{ background: pad.color }}
                    aria-hidden="true"
                  />
                  <button
                    type="button"
                    className="pad-editor-row__body"
                    style={{ textAlign: 'left' }}
                    onClick={() => setSelectedId(pad.id === selectedId ? null : pad.id)}
                  >
                    <span className="pad-editor-row__name">{pad.name}</span>
                    <span className="pad-editor-row__meta">
                      <PadIcon name={pad.icon} size={13} />
                      {asset ? asset.name : 'Sin archivo asignado'}
                      {' · '}
                      {PAD_MODE_LABELS[pad.mode]}
                      {pad.shortcut ? ` · ${formatShortcut(pad.shortcut)}` : ''}
                    </span>
                  </button>
                  <div className="pad-editor-row__actions">
                    <button
                      type="button"
                      className="icon-btn"
                      onClick={() => {
                        const asset = assets.find((entry) => entry.id === pad.assetId);
                        if (asset) void audioController.previewAsset(asset);
                        else
                          useUiStore
                            .getState()
                            .pushToast(
                              `«${pad.name}» todavía no tiene archivo.`,
                              'warning',
                            );
                      }}
                      aria-label={`Escuchar ${pad.name}`}
                      title="Escuchar"
                    >
                      <Play size={16} />
                    </button>
                    <button
                      type="button"
                      className="icon-btn"
                      onClick={() => movePad(pad.id, -1)}
                      disabled={index === 0}
                      aria-label={`Subir ${pad.name}`}
                      title="Subir"
                    >
                      <ChevronUp size={16} />
                    </button>
                    <button
                      type="button"
                      className="icon-btn"
                      onClick={() => movePad(pad.id, 1)}
                      disabled={index === pads.length - 1}
                      aria-label={`Bajar ${pad.name}`}
                      title="Bajar"
                    >
                      <ChevronDown size={16} />
                    </button>
                    <button
                      type="button"
                      className="icon-btn"
                      onClick={() => duplicatePad(pad.id)}
                      aria-label={`Duplicar ${pad.name}`}
                      title="Duplicar"
                    >
                      <Copy size={16} />
                    </button>
                    <button
                      type="button"
                      className="icon-btn"
                      onClick={() => removePad(pad.id)}
                      aria-label={`Eliminar ${pad.name}`}
                      title="Eliminar"
                    >
                      <Trash2 size={16} />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </section>

      <section className="card">
        <div className="card__header">
          <div className="card__heading">
            <h3 className="card__title">Ajustes del botón</h3>
            <p className="card__description">
              {selected ? `«${selected.name}».` : 'Elige un botón de la lista.'}
            </p>
          </div>
        </div>
        <div className="card__body">
          {selected ? (
            <PadForm
              key={selected.id}
              pad={selected}
              onChange={(changes) => updatePad(selected.id, changes)}
            />
          ) : (
            <p className="field__hint">
              Selecciona un botón de la lista para ver sus opciones.
            </p>
          )}
        </div>
      </section>
    </div>
  );
}

function PadForm({
  pad,
  onChange,
}: {
  pad: SoundPad;
  onChange: (changes: Partial<SoundPad>) => void;
}) {
  const project = useProjectStore((state) => state.project);
  const settings = useSettingsStore((state) => state.settings);
  const assets = project?.assets ?? [];
  const pads = project?.pads ?? [];

  const conflict = pad.shortcut
    ? findConflict(
        pad.shortcut,
        pads.map((entry) => ({
          id: entry.id,
          name: entry.name,
          shortcut: entry.shortcut,
        })),
        settings.globalBindings,
        pad.id,
      )
    : null;

  return (
    <div className="stack">
      <div className="field">
        <label className="field__label" htmlFor={`pad-name-${pad.id}`}>
          Nombre del botón
        </label>
        <input
          id={`pad-name-${pad.id}`}
          className="input"
          value={pad.name}
          maxLength={60}
          onChange={(event) => onChange({ name: event.target.value })}
        />
      </div>

      <div className="field">
        <label className="field__label" htmlFor={`pad-asset-${pad.id}`}>
          Archivo que sonará
        </label>
        <select
          id={`pad-asset-${pad.id}`}
          className="select"
          value={pad.assetId ?? ''}
          onChange={(event) => onChange({ assetId: event.target.value || null })}
        >
          <option value="">Elige un archivo</option>
          {assets.map((asset) => (
            <option key={asset.id} value={asset.id}>
              {asset.name}
            </option>
          ))}
        </select>
        <span className="field__hint">
          Si borras el botón, el archivo se queda en la presentación.
        </span>
      </div>

      <div className="field">
        <span className="field__label">Color</span>
        <div className="row row--wrap">
          {PAD_COLORS.map((color) => (
            <button
              key={color}
              type="button"
              className="icon-btn"
              aria-label={`Color ${color}`}
              aria-pressed={pad.color === color}
              onClick={() => onChange({ color })}
              style={{
                background: color,
                width: 26,
                height: 26,
                borderRadius: 8,
                outline: pad.color === color ? '2px solid var(--text)' : 'none',
                outlineOffset: 2,
              }}
            />
          ))}
        </div>
      </div>

      <div className="field">
        <label className="field__label" htmlFor={`pad-icon-${pad.id}`}>
          Icono
        </label>
        <select
          id={`pad-icon-${pad.id}`}
          className="select"
          value={pad.icon}
          onChange={(event) => onChange({ icon: event.target.value })}
        >
          {PAD_ICON_NAMES.map((name) => (
            <option key={name} value={name}>
              {name}
            </option>
          ))}
        </select>
      </div>

      <div className="field">
        <label className="field__label" htmlFor={`pad-volume-${pad.id}`}>
          Volumen de este sonido · {Math.round(pad.volume * 100)} %
        </label>
        <Slider
          id={`pad-volume-${pad.id}`}
          value={pad.volume}
          label="Volumen de este sonido"
          onChange={(next) => onChange({ volume: next })}
        />
      </div>

      <div className="field">
        <label className="field__label" htmlFor={`pad-mode-${pad.id}`}>
          Cómo suena
        </label>
        <select
          id={`pad-mode-${pad.id}`}
          className="select"
          value={pad.mode}
          onChange={(event) =>
            onChange({ mode: event.target.value as SoundPad['mode'] })
          }
        >
          {PAD_MODES.map((mode) => (
            <option key={mode} value={mode}>
              {PAD_MODE_LABELS[mode]}
            </option>
          ))}
        </select>
        <span className="field__hint">
          {pad.mode === 'hold'
            ? 'Suena mientras mantengas pulsada la tecla. Se corta al soltar.'
            : pad.mode === 'loop'
              ? 'Se repite hasta que lo detengas.'
              : 'Suena una vez y se para al terminar.'}
        </span>
      </div>

      <div className="field">
        <span className="field__label">
          <Keyboard size={13} style={{ verticalAlign: -2, marginRight: 4 }} />
          Tecla
        </span>
        <ShortcutInput
          value={pad.shortcut}
          onChange={(shortcut) => onChange({ shortcut })}
        />
        {conflict ? (
          <span className="shortcut-conflict row">
            <TriangleAlert size={13} />
            Esa tecla ya la usa: {conflict.label}
          </span>
        ) : (
          <span className="field__hint">Opcional. También puedes tocar el botón.</span>
        )}
      </div>

      <div className="field">
        <label className="switch">
          <input
            type="checkbox"
            checked={pad.enabled}
            onChange={(event) => onChange({ enabled: event.target.checked })}
          />
          <span className="switch__control" aria-hidden="true" />
          <span className="switch__label">Botón disponible en «En vivo»</span>
        </label>
      </div>
    </div>
  );
}

export function ShortcutInput({
  value,
  onChange,
  allowClear = true,
}: {
  value: string | null;
  onChange: (value: string | null) => void;
  allowClear?: boolean;
}) {
  const [capturing, setCapturing] = useState(false);

  useEffect(() => {
    if (!capturing) return;

    const onKeyDown = (event: KeyboardEvent) => {
      event.preventDefault();
      event.stopPropagation();
      if (event.key === 'Escape') {
        setCapturing(false);
        return;
      }
      onChange(comboToId(comboFromEvent(event)));
      setCapturing(false);
    };

    window.addEventListener('keydown', onKeyDown, true);
    return () => window.removeEventListener('keydown', onKeyDown, true);
  }, [capturing, onChange]);

  return (
    <div className="row">
      <button
        type="button"
        className="btn btn--secondary shortcut-capture"
        data-capturing={capturing}
        onClick={() => setCapturing((current) => !current)}
      >
        {capturing ? 'Pulsa una tecla…' : formatShortcut(value)}
      </button>
      {allowClear && value ? (
        <button
          type="button"
          className="icon-btn"
          onClick={() => onChange(null)}
          aria-label="Quitar atajo"
          title="Quitar atajo"
        >
          ×
        </button>
      ) : null}
    </div>
  );
}
