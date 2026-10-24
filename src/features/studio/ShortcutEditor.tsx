import { RotateCcw } from 'lucide-react';
import { ShortcutInput } from './PadEditor';
import { DEFAULT_GLOBAL_BINDINGS, GLOBAL_SHORTCUTS } from '../shortcuts/shortcutRegistry';
import { useSettingsStore } from '../../stores/settingsStore';

export function ShortcutEditor() {
  const settings = useSettingsStore((state) => state.settings);
  const patch = useSettingsStore((state) => state.patch);

  return (
    <section className="card">
      <div className="card__header">
        <div className="card__heading">
          <h2 className="card__title">Atajos de la aplicación</h2>
          <p className="card__description">
            Se aplican dentro de la ventana de CueStage mientras está en primer plano.
          </p>
        </div>
        <button
          type="button"
          className="btn btn--ghost btn--sm"
          onClick={() => patch({ globalBindings: { ...DEFAULT_GLOBAL_BINDINGS } })}
        >
          <RotateCcw size={15} />
          Restaurar valores
        </button>
      </div>
      <div className="card__body">
        <div className="shortcut-table">
          {GLOBAL_SHORTCUTS.map((definition) => (
            <div key={definition.action} className="shortcut-table__row">
              <div className="settings-row__body">
                <span className="settings-row__title">{definition.label}</span>
                <span className="settings-row__description">
                  {definition.description}
                </span>
              </div>
              <ShortcutInput
                value={settings.globalBindings[definition.action] ?? null}
                onChange={(value) =>
                  patch({
                    globalBindings: {
                      ...settings.globalBindings,
                      [definition.action]: value ?? '',
                    },
                  })
                }
              />
            </div>
          ))}
        </div>
        <p className="field__hint" style={{ marginTop: 'var(--space-4)' }}>
          Los atajos globales de Windows (fuera de la aplicación) no están implementados en
          esta versión. Los atajos sueltos no se repiten automáticamente, para no disparar
          dos veces el mismo efecto.
        </p>
      </div>
    </section>
  );
}
